import * as github from '@actions/github'
import * as core from '@actions/core'
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
  static async scanAndGetManifests(path: string): Promise<any[] | undefined> {
    await this.downloadLatestRelease();
    await this.runComponentDetection(path);
    return await this.getManifestsFromResults();
  }
  // Get the latest release from the component-detection repo, download the tarball, and extract it
  public static async downloadLatestRelease() {
    try {
      core.debug(`Downloading latest release for ${process.platform}`);
      const downloadURL = await this.getLatestReleaseURL();
      core.info(`Download URL: ${downloadURL}`);
      const blob = await (await fetch(new URL(downloadURL))).blob();
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Write the blob to a file
      core.debug(`Writing binary to file ${this.componentDetectionPath}`);
      await fs.writeFileSync(this.componentDetectionPath, buffer, { mode: 0o777, flag: 'w' });
      core.info(`Binary written to ${this.componentDetectionPath}`);
      core.info(`File exists: ${fs.existsSync(this.componentDetectionPath)}`);
      core.info(`File permissions: ${fs.statSync(this.componentDetectionPath).mode.toString(8)}`);
    } catch (error: any) {
      core.error(error);
      core.info(`Download or write failed: ${error.message}`);
    }
  }

  // Run the component-detection CLI on the path specified
  public static async runComponentDetection(path: string) {
    core.info("Running component-detection");
    core.info(`CLI path: ${this.componentDetectionPath}`);
    core.info(`Output path: ${this.outputPath}`);
    try {
      await exec.exec(`${this.componentDetectionPath} scan --SourceDirectory ${path} --ManifestFile ${this.outputPath} ${this.getComponentDetectionParameters()}`);
      core.info(`CLI run complete. Output exists: ${fs.existsSync(this.outputPath)}`);
    } catch (error: any) {
      core.error(error);
      core.info(`CLI run failed: ${error.message}`);
    }
  }

  private static getComponentDetectionParameters(): string {
    var parameters = "";
    parameters += (core.getInput('directoryExclusionList')) ? ` --DirectoryExclusionList ${core.getInput('directoryExclusionList')}` : "";
    parameters += (core.getInput('detectorArgs')) ? ` --DetectorArgs ${core.getInput('detectorArgs')}` : "";
    parameters += (core.getInput('detectorsFilter')) ? ` --DetectorsFilter ${core.getInput('detectorsFilter')}` : "";
    parameters += (core.getInput('dockerImagesToScan')) ? ` --DockerImagesToScan ${core.getInput('dockerImagesToScan')}` : "";
    return parameters;
  }

  public static async getManifestsFromResults(): Promise<any[] | undefined> {
    core.info("Getting manifests from results");
    // Dynamically import toolkit
    const toolkit = await import('@github/dependency-submission-toolkit');
    const PackageCache = toolkit.PackageCache;
    const Manifest = toolkit.Manifest;
    const Package = toolkit.Package;
    // Define a dynamic class extending Package
    class ComponentDetectionPackage extends Package {
      id: any;
      isDevelopmentDependency: any;
      topLevelReferrers: any;
      locationsFoundAt: any;
      containerDetailIds: any;
      containerLayerIds: any;
      constructor(packageUrl: string, id: any, isDevelopmentDependency: any, topLevelReferrers: any, locationsFoundAt: any, containerDetailIds: any, containerLayerIds: any) {
        super(packageUrl);
        this.id = id;
        this.isDevelopmentDependency = isDevelopmentDependency;
        this.topLevelReferrers = topLevelReferrers;
        this.locationsFoundAt = locationsFoundAt;
        this.containerDetailIds = containerDetailIds;
        this.containerLayerIds = containerLayerIds;
      }
    }
    // Parse the result file and add the packages to the package cache
    const packageCache = new PackageCache();
    const packages: Array<any> = [];

    const results = await fs.readFileSync(this.outputPath, 'utf8');

    var json: any = JSON.parse(results);
    json.componentsFound.forEach(async (component: any) => {
      const packageUrl = ComponentDetection.makePackageUrl(component.component.packageUrl);

      if (!packageCache.hasPackage(packageUrl)) {
        const pkg = new ComponentDetectionPackage(
          packageUrl,
          component.component.id,
          component.isDevelopmentDependency,
          component.topLevelReferrers,
          component.locationsFoundAt,
          component.containerDetailIds,
          component.containerLayerIds
        );
        packageCache.addPackage(pkg);
        packages.push(pkg);
      }
    });

    // Set the transitive dependencies
    core.debug("Sorting out transitive dependencies");
    packages.forEach(async (pkg: any) => {
      pkg.topLevelReferrers.forEach(async (referrer: any) => {
        const referrerPackage = packageCache.lookupPackage(ComponentDetection.makePackageUrl(referrer.packageUrl));
        if (referrerPackage) {
          referrerPackage.dependsOn(pkg);
        }
      });
    });

    // Create manifests
    const manifests: Array<any> = [];

    // Check the locationsFoundAt for every package and add each as a manifest
    packages.forEach(async (pkg: any) => {
      pkg.locationsFoundAt.forEach(async (location: any) => {
        if (!manifests.find((manifest: any) => manifest.name == location)) {
          const manifest = new Manifest(location, location);
          manifests.push(manifest);
        }
        if (pkg.topLevelReferrers.length == 0) {
          manifests.find((manifest: any) => manifest.name == location)?.addDirectDependency(pkg, ComponentDetection.getDependencyScope(pkg));
        } else {
          manifests.find((manifest: any) => manifest.name == location)?.addIndirectDependency(pkg, ComponentDetection.getDependencyScope(pkg));
        }
      });
    });
    return manifests;
  }

  private static getDependencyScope(pkg: any) {
    return pkg.isDevelopmentDependency ? 'development' : 'runtime'
  }

  public static makePackageUrl(packageUrlJson: any): string {
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
  }

  private static async getLatestReleaseURL(): Promise<string> {
    let githubToken = core.getInput('token') || process.env.GITHUB_TOKEN || "";

    const githubAPIURL = 'https://api.github.com' 

    let ghesMode = github.context.apiUrl != githubAPIURL;
    // If the we're running in GHES, then use an empty string as the token  
    if (ghesMode) {
      githubToken = "";
    }
    // Dynamically import octokit
    const { Octokit } = await import("octokit");
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










