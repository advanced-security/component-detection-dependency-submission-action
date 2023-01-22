import * as github from '@actions/github'
import * as core from '@actions/core'
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
  private componentDetectionPath = './component-detection';
  private outputPath = './output.json';

  // This is the default entry point for this class. 
  static async scanAndGetManifests(path: string): Promise<Manifest[] | undefined> {
    await this.downloadLatestRelease();
    await this.runComponentDetection(path);
    return await this.getManifestsFromResults();
  }
  // Get the latest release from the component-detection repo, download the tarball, and extract it
  private static async downloadLatestRelease() {
    try {
      const downloadURL = await getLatestReleaseURL();
      const blob = await (await fetch(new URL(downloadURL))).blob();
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Write the blob to a file
      await fs.writeFile(componentDetectionPath, buffer, {mode: 0o777, flag: 'w'}, 
      (err: any) => {
        if (err) {  
          core.error(err);
        }
      });
    } catch (error: any) {
      core.error(error);
    } 
  }

  // Run the component-detection CLI on the path specified
  private static async runComponentDetection(path: string) {
    try {
      await exec.exec(`${componentDetectionPath} scan --SourceDirectory ${path} --ManifestFile ${outputPath}`);
    } catch (error: any) {
      core.error(error);
    }
  }

  private static async getManifestsFromResults(): Promise<Manifest[]| undefined> {
    
    try {
      // Parse the result file and add the packages to the package cache
      const packageCache = new PackageCache();
      const packages: Array<ComponentDetectionPackage>= [];
      
      const results = await fs.readFileSync(outputPath, 'utf8');
      
      var json: any = JSON.parse(results);
      json.componentsFound.forEach(async (component: any) => {
        const packageUrl = makePackageUrl(component.component.packageUrl);
        
        if (!packageCache.hasPackage(packageUrl)) {
          const pkg = new ComponentDetectionPackage(packageUrl, component.component.id, 
            component.isDevelopmentDependency,component.topLevelReferrers,component.locationsFoundAt, component.containerDetailIds, component.containerLayerIds);
          packageCache.addPackage(pkg);
          packages.push(pkg);
        }
      });

      // Set the transitive dependencies
      packages.forEach(async (pkg: ComponentDetectionPackage) => {
        pkg.toplevelReferrers.forEach(async (referrer: any) => {
          const referrerPackage = packageCache.lookupPackage(makePackageUrl(referrer.packageUrl));
          if (referrerPackage) {
            referrerPackage.dependsOn(pkg);
          }
        });
      });

      // Create manifests
      const manifests: Array<Manifest> = [];

      // Check the locationsFoundAt for every package and add each as a manifest
      packages.forEach(async (pkg: ComponentDetectionPackage) => {
        pkg.locationsFoundAt.forEach(async (location: any) => {
          if (!manifests[location.filePath]) {
            const manifest = new Manifest(location.filePath, location.filePath);
            manifests.push(manifest);
          }
          if (pkg.toplevelReferrers.length == 0) {
            manifests.find((manifest: Manifest) => manifest.file == location.filePath)?.addDirectDependency(pkg, getDependencyScope(pkg));
          } else {
            manifests.find((manifest: Manifest) => manifest.file == location.filePath)?.addIndirectDependency(pkg, getDependencyScope(pkg));        }
        });
      });
      core.debug(JSON.stringify(manifests));
      return manifests;
    } catch (error: any) {
      core.error(error);
      return undefined;
    }
  }

  private static getDependencyScope(pkg: ComponentDetectionPackage) {
    return pkg.isDevelopmentDependency ? 'development' : 'runtime'
  }

  private static makePackageUrl(packageUrlJson: any): string {
    var packageUrl = `${packageUrlJson.Scheme}:${packageUrlJson.Type}/`;
    if (packageUrlJson.Namespace) {
      packageUrl += `${packageUrlJson.Namespace.replace("@", "%40")}/`;
    }
    packageUrl += `${packageUrlJson.Name.replace("@", "%40")}`;
    if (packageUrlJson.Version) {
      packageUrl += `@${packageUrlJson.Version}`;
    }
    if (packageUrlJson.Qualifiers) {
      packageUrl += `?${packageUrlJson.Qualifiers}`;
    }
    return packageUrl;
  }

  private static getLatestReleaseURL(): Promise<string> {
    const githubToken  = core.getInput('token') || process.env.GITHUB_TOKEN2 || "";  
    const octokit = github.getOctokit(githubToken);
    const owner = "microsoft";
    const repo = "component-detection";

    const latestRelease = await octokit.rest.repos.getLatestRelease({
      owner, repo
    });

    var downloadURL: string = "";
    latestRelease.data.assets.forEach((asset: any) => {
      if (asset.name === "component-detection-linux-x64") {
        downloadURL = asset.browser_download_url;
      }
    });

    return downloadURL;
  }
}

class ComponentDetectionPackage extends Package {
  
  constructor(packageUrl: string, id: string, isDevelopmentDependency:boolean, topLevelReferrers: [], 
    locationsFoundAt: [], containerDetailIds: [], containerLayerIds: []) {
    super(packageUrl);
    this.id = id;
    this.isDevelopmentDependency = isDevelopmentDependency;
    this.toplevelReferrers = topLevelReferrers;
    this.locationsFoundAt = locationsFoundAt;
    this.containerDetailIds = containerDetailIds;
    this.containerLayerIds = containerLayerIds;
  }
  id: string;
  isDevelopmentDependency: boolean;
  toplevelReferrers: [];
  locationsFoundAt: [];
  containerDetailIds: [];
  containerLayerIds: [];
}










