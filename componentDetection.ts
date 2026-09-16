import * as github from '@actions/github'
import * as core from '@actions/core'
import { Octokit } from "octokit"
import {
  BuildTarget,
  Package,
  Snapshot,
  Manifest,
  submitSnapshot,
} from '@github/dependency-submission-toolkit'
import fs from 'fs'
import * as exec from '@actions/exec';
import dotenv from 'dotenv'
import path from 'path';
import { 
  EnvHttpProxyAgent, 
  fetch as undiciFetch, 
  type RequestInit as UndiciRequestInit, 
  type Response as UndiciResponse 
} from 'undici';

dotenv.config();

const proxyAgent = new EnvHttpProxyAgent();

export default class ComponentDetection {
  public static componentDetectionPath = process.platform === "win32" ? './component-detection.exe' : './component-detection';
  public static outputPath = './output.json';

  // This is the default entry point for this class.
  static async scanAndGetManifests(path: string): Promise<Manifest[] | undefined> {
    await this.downloadLatestRelease();
    await this.runComponentDetection(path);
    return await this.getManifestsFromResults(path);
  }
  // Get the latest release from the component-detection repo, download the tarball, and extract it
  public static async downloadLatestRelease() {
    try {
      core.debug(`Downloading latest release for ${process.platform}`);
      const downloadURL = await this.getLatestReleaseURL();
      const blob = await (await this.fetchWithProxy(new URL(downloadURL))).blob();
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Write the blob to a file
      core.debug(`Writing binary to file ${this.componentDetectionPath}`);
      await fs.writeFileSync(this.componentDetectionPath, buffer, { mode: 0o777, flag: 'w' });
    } catch (error: any) {
      core.error(error);
    }
  }

  // Run the component-detection CLI on the path specified
  public static async runComponentDetection(path: string) {
    core.info("Running component-detection");

    try {
      await exec.exec(`${this.componentDetectionPath} scan --SourceDirectory ${path} --ManifestFile ${this.outputPath} ${this.getComponentDetectionParameters()}`);
    } catch (error: any) {
      core.error(error);
    }
  }

  private static getComponentDetectionParameters(): string {
    var parameters = "";
    parameters += (core.getInput('directoryExclusionList')) ? ` --DirectoryExclusionList ${core.getInput('directoryExclusionList')}` : "";
    parameters += (core.getInput('detectorArgs')) ? ` --DetectorArgs ${core.getInput('detectorArgs')}` : "";
    parameters += (core.getInput('detectorsFilter')) ? ` --DetectorsFilter ${core.getInput('detectorsFilter')}` : "";
    parameters += (core.getInput('detectorsCategories')) ? ` --DetectorCategories ${core.getInput('detectorsCategories')}` : "";
    parameters += (core.getInput('dockerImagesToScan')) ? ` --DockerImagesToScan ${core.getInput('dockerImagesToScan')}` : "";
    return parameters;
  }

  public static async getManifestsFromResults(
    filePathInput: string = core.getInput('filePath')
  ): Promise<Manifest[] | undefined> {
    core.info("Getting manifests from results");
    const results = await fs.readFileSync(this.outputPath, 'utf8');
    var json: any = JSON.parse(results);
    let dependencyGraphs: DependencyGraphs = this.normalizeDependencyGraphPaths(json.dependencyGraphs, filePathInput);
    return this.processComponentsToManifests(json.componentsFound, dependencyGraphs);
  }

  public static processComponentsToManifests(componentsFound: any[], dependencyGraphs: DependencyGraphs): Manifest[] {
    const packagesById: Map<string, ComponentDetectionPackage> = new Map();

    componentsFound.forEach((component: any) => {
      // Skip components without packageUrl
      if (!component.component.packageUrl) {
        core.debug(`Skipping component detected without packageUrl: ${JSON.stringify({
          id: component.component.id,
          name: component.component.name || 'unnamed',
          type: component.component.type || 'unknown'
        }, null, 2)}`);
        return;
      }

      const packageUrl = ComponentDetection.makePackageUrl(component.component.packageUrl);

      // Skip if the packageUrl is empty (indicates an invalid or missing packageUrl)
      if (!packageUrl) {
        core.debug(`Skipping component with invalid packageUrl: ${component.component.id}`);
        return;
      }

      packagesById.set(
        component.component.id,
        new ComponentDetectionPackage(
          packageUrl,
          component.component.id,
          component.isDevelopmentDependency
        )
      );
    });

    return this.createManifests(packagesById, dependencyGraphs);
  }

  private static createManifests(
    packageDefinitionsById: Map<string, ComponentDetectionPackage>,
    dependencyGraphs: DependencyGraphs
  ): Manifest[] {
    return Object.entries(dependencyGraphs).map(([location, dependencyGraph]) => {
      const manifest = new Manifest(location, location);
      const manifestPackagesById: Map<string, ComponentDetectionPackage> = new Map();

      for (const componentId of Object.keys(dependencyGraph.graph)) {
        const packageDefinition = packageDefinitionsById.get(componentId);
        if (!packageDefinition) {
          core.warning(`No package found for component in dependency graph ${location}: ${componentId}`);
          continue;
        }

        manifestPackagesById.set(
          componentId,
          new ComponentDetectionPackage(
            packageDefinition.packageUrlString,
            packageDefinition.id,
            packageDefinition.isDevelopmentDependency
          )
        );
      }

      for (const [componentId, dependencyIds] of Object.entries(dependencyGraph.graph)) {
        const pkg = manifestPackagesById.get(componentId);
        if (!pkg || !dependencyIds) {
          continue;
        }

        for (const dependencyId of dependencyIds) {
          const dependency = manifestPackagesById.get(dependencyId);
          if (dependency && dependency !== pkg) {
            pkg.dependsOn(dependency);
          }
        }
      }

      const directDependencies = new Set(dependencyGraph.explicitlyReferencedComponentIds);
      for (const [componentId, pkg] of manifestPackagesById) {
        const scope = ComponentDetection.getDependencyScope(pkg, componentId, dependencyGraph);
        if (directDependencies.has(componentId)) {
          manifest.addDirectDependency(pkg, scope);
        } else {
          manifest.addIndirectDependency(pkg, scope);
        }
      }

      return manifest;
    });
  }

  private static getDependencyScope(
    pkg: ComponentDetectionPackage,
    componentId: string,
    dependencyGraph: DependencyGraph
  ) {
    if (dependencyGraph.dependencies.includes(componentId)) {
      return 'runtime';
    }

    if (dependencyGraph.developmentDependencies.includes(componentId)) {
      return 'development';
    }

    return pkg.isDevelopmentDependency ? 'development' : 'runtime'
  }

  public static makePackageUrl(packageUrlJson: any): string {
    // Handle case when packageUrlJson is null or undefined
    if (
      !packageUrlJson ||
      typeof packageUrlJson.Scheme !== 'string' ||
      typeof packageUrlJson.Type !== 'string' ||
      !packageUrlJson.Scheme ||
      !packageUrlJson.Type
    ) {
      core.debug(`Warning: Received null or undefined packageUrlJson. Unable to create package URL.`);
      return ""; // Return a blank string for unknown packages
    }

    try {
      var packageUrl = `${packageUrlJson.Scheme}:${packageUrlJson.Type}/`;
      if (packageUrlJson.Namespace) {
        packageUrl += `${packageUrlJson.Namespace.replaceAll("@", "%40")}/`;
      }
      packageUrl += `${packageUrlJson.Name.replaceAll("@", "%40")}`;
      if (packageUrlJson.Version) {
        packageUrl += `@${packageUrlJson.Version}`;
      }
      if (typeof packageUrlJson.Qualifiers === "object"
        && packageUrlJson.Qualifiers !== null
        && Object.keys(packageUrlJson.Qualifiers).length > 0) {
        const qualifierString = Object.entries(packageUrlJson.Qualifiers)
          .map(([key, value]) => `${key}=${value}`)
          .join("&");
        packageUrl += `?${qualifierString}`;
      }
      return packageUrl;
    } catch (error) {
      core.debug(`Error creating package URL from packageUrlJson: ${JSON.stringify(packageUrlJson, null, 2)}`);
      core.debug(`Error details: ${error}`);
      return ""; // Return a blank string for error cases
    }
  }

  private static async getLatestReleaseURL(): Promise<string> {
    let githubToken = core.getInput('token') || process.env.GITHUB_TOKEN || "";

    const githubAPIURL = 'https://api.github.com'

    let ghesMode = github.context.apiUrl != githubAPIURL;
    // If the we're running in GHES, then use an empty string as the token
    if (ghesMode) {
      githubToken = "";
    }
    const octokit = new Octokit({ auth: githubToken, baseUrl: githubAPIURL, request: { fetch: this.fetchWithProxy}, log: {
      debug: core.debug,
      info: core.info,
      warn: core.warning,
      error: core.error
    }, });

    const owner = "microsoft";
    const repo = "component-detection";
    core.debug("Attempting to download latest release from " + githubAPIURL);

    try {
      const latestRelease = await octokit.request("GET /repos/{owner}/{repo}/releases/latest", {owner, repo});

    var downloadURL: string = "";
    const assetName = process.platform === "win32" ? "component-detection-win-x64.exe" : "component-detection-linux-x64";
    latestRelease.data.assets.forEach((asset: any) => {
      if (asset.name === assetName) {
        downloadURL = asset.browser_download_url;
      }
    });

    return downloadURL;
    } catch (error: any) {
      core.error(error);
      core.debug(error.message);
      core.debug(error.stack);
      throw new Error("Failed to download latest release");
    }
  }

  private static async fetchWithProxy(url: string | URL, options?: UndiciRequestInit) : Promise<UndiciResponse> {
    return undiciFetch(url, {
      ...options,
      dispatcher: proxyAgent
    });
  }

  /**
   * Normalizes the keys of a DependencyGraphs object to be relative paths from the resolved filePath input.
   * @param dependencyGraphs The DependencyGraphs object to normalize.
   * @param filePathInput The filePath input (relative or absolute) from the action configuration.
   * @returns A new DependencyGraphs object with relative path keys.
   */
  public static normalizeDependencyGraphPaths(
    dependencyGraphs: DependencyGraphs,
    filePathInput: string
  ): DependencyGraphs {
    // Resolve the base directory from filePathInput (relative to cwd if not absolute)
    const baseDir = path.resolve(process.cwd(), filePathInput);
    const normalized: DependencyGraphs = {};
    for (const absPath in dependencyGraphs) {
      // Make the path relative to the baseDir
      let relPath = path.relative(baseDir, absPath).replace(/\\/g, '/');
      normalized[relPath] = dependencyGraphs[absPath];
    }
    return normalized;
  }
}

class ComponentDetectionPackage extends Package {
  public packageUrlString: string;

  constructor(packageUrl: string, public id: string, public isDevelopmentDependency: boolean) {
    super(packageUrl);
    this.packageUrlString = packageUrl;
  }
}

/**
 * Types for the dependencyGraphs section of output.json
 */
export type DependencyGraph = {
  /**
   * The dependency graph: keys are component IDs, values are either null (no dependencies) or an array of component IDs (dependencies)
   */
  graph: Record<string, string[] | null>;
  /**
   * Explicitly referenced component IDs
   */
  explicitlyReferencedComponentIds: string[];
  /**
   * Development dependencies
   */
  developmentDependencies: string[];
  /**
   * Regular dependencies
   */
  dependencies: string[];
};

/**
 * The top-level dependencyGraphs object: keys are manifest file paths, values are DependencyGraph objects
 */
export type DependencyGraphs = Record<string, DependencyGraph>;






