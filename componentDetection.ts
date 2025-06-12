import * as github from '@actions/github'
import * as core from '@actions/core'
import { Octokit, App } from "octokit"
import {
  PackageCache,
  BuildTarget,
  Package,
  Snapshot,
  Manifest,
  submitSnapshot
} from '@github/dependency-submission-toolkit'
import fetch from 'cross-fetch'
import tar from 'tar'
import fs from 'fs'
import * as exec from '@actions/exec';
import dotenv from 'dotenv'
import { Context } from '@actions/github/lib/context'
import { unmockedModulePathPatterns } from './jest.config'
dotenv.config();

export default class ComponentDetection {
  public static componentDetectionPath = process.platform === "win32" ? './component-detection.exe' : './component-detection';
  public static outputPath = './output.json';

  // This is the default entry point for this class.
  static async scanAndGetManifests(path: string): Promise<Manifest[] | undefined> {
    await this.downloadLatestRelease();
    await this.runComponentDetection(path);
    return await this.getManifestsFromResults();
  }
  // Get the latest release from the component-detection repo, download the tarball, and extract it
  public static async downloadLatestRelease() {
    try {
      core.debug(`Downloading latest release for ${process.platform}`);
      const downloadURL = await this.getLatestReleaseURL();
      const blob = await (await fetch(new URL(downloadURL))).blob();
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

  public static async getManifestsFromResults(): Promise<Manifest[] | undefined> {
    core.info("Getting manifests from results");
    // Parse the result file and add the packages to the package cache
    const packageCache = new PackageCache();
    const packages: Array<ComponentDetectionPackage> = [];

    const results = await fs.readFileSync(this.outputPath, 'utf8');

    var json: any = JSON.parse(results);
    json.componentsFound.forEach(async (component: any) => {
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

      if (!packageCache.hasPackage(packageUrl)) {
        const pkg = new ComponentDetectionPackage(packageUrl, component.component.id,
          component.isDevelopmentDependency, component.topLevelReferrers, component.locationsFoundAt, component.containerDetailIds, component.containerLayerIds);
        packageCache.addPackage(pkg);
        packages.push(pkg);
      }
    });

    // Set the transitive dependencies
    core.debug("Sorting out transitive dependencies");
    packages.forEach(async (pkg: ComponentDetectionPackage) => {
      pkg.topLevelReferrers.forEach(async (referrer: any) => {
        // Skip if referrer doesn't have a valid packageUrl
        if (!referrer.packageUrl) {
          core.debug(`Skipping referrer without packageUrl for component: ${pkg.id}`);
          return;
        }

        const referrerUrl = ComponentDetection.makePackageUrl(referrer.packageUrl);

        // Skip if the generated packageUrl is empty
        if (!referrerUrl) {
          core.debug(`Skipping referrer with invalid packageUrl for component: ${pkg.id}`);
          return;
        }

        try {
          const referrerPackage = packageCache.lookupPackage(referrerUrl);
          if (referrerPackage) {
            referrerPackage.dependsOn(pkg);
          }
        } catch (error) {
          core.debug(`Error looking up referrer package: ${error}`);
        }
      });
    });

    // Create manifests
    const manifests: Array<Manifest> = [];

    // Check the locationsFoundAt for every package and add each as a manifest
    packages.forEach(async (pkg: ComponentDetectionPackage) => {
      pkg.locationsFoundAt.forEach(async (location: any) => {
        if (!manifests.find((manifest: Manifest) => manifest.name == location)) {
          const manifest = new Manifest(location, location);
          manifests.push(manifest);
        }
        if (pkg.topLevelReferrers.length == 0) {
          manifests.find((manifest: Manifest) => manifest.name == location)?.addDirectDependency(pkg, ComponentDetection.getDependencyScope(pkg));
        } else {
          manifests.find((manifest: Manifest) => manifest.name == location)?.addIndirectDependency(pkg, ComponentDetection.getDependencyScope(pkg));
        }
      });
    });
    return manifests;
  }

  private static getDependencyScope(pkg: ComponentDetectionPackage) {
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
    const octokit = new Octokit({ auth: githubToken, baseUrl: githubAPIURL, request: { fetch: fetch}, log: {
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
}

class ComponentDetectionPackage extends Package {

  constructor(packageUrl: string, public id: string, public isDevelopmentDependency: boolean, public topLevelReferrers: [],
    public locationsFoundAt: [], public containerDetailIds: [], public containerLayerIds: []) {
    super(packageUrl);
  }
}










