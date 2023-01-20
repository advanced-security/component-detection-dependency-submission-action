import * as core from '@actions/core';
import * as yaml from 'yaml';
import * as glob from 'glob';
import * as fs from 'fs';

import {
  PackageCache,
  BuildTarget,
  Package,
  Snapshot,
  Manifest,
  submitSnapshot
} from '@github/dependency-submission-toolkit'

export default class CondaParser {

  static searchFiles(filePath = "", filePattern = "") {
    core.debug(`Searching for files in ${filePath} with pattern ${filePattern}`);
    return glob.sync(`${filePath}/${filePattern}`, {});
  }

  static getManifestsFromEnvironmentFiles(files: string[]) {
    core.debug(`Processing ${files.length} files`);
    let manifests: any[] = [];
    files?.forEach(filePath => {
        core.debug(`Processing ${filePath}`);
        const contents = fs.readFileSync(filePath, 'utf8')
        manifests.push(CondaParser.getManifestFromYaml(yaml.parse(contents), filePath));
    });
    return manifests;
  }

  // Gets a Manifest object from an environment.yaml
  static getManifestFromYaml(yaml: any, filePath: string) {
    core.debug(`getManifestFromEnvironmentFile processing ${yaml}`);

    let manifest = new Manifest(yaml.name, filePath);
    yaml.dependencies?.forEach((dependency: any) => {
      let purl = "";
      // If it's an object with the collection `pip`, then these are PyPI dependencies
      if (dependency instanceof Object && dependency.pip != null) {
        dependency.pip.forEach((pipDependency:string) => {
          purl = this.getPurlFromDependency(pipDependency, "pypi");
          manifest.addDirectDependency(new Package(purl));
        });
      } else {
        purl = this.getPurlFromDependency(dependency, "conda");
        manifest.addDirectDependency(new Package(purl));
      }
    });
    return manifest;
  }
  
  // Gets a purl string from an environment file's list of dependencies
  static getPurlFromDependency(dependency: string, ecosystem: string) {
    // Versions look like "python=3.8" or if nested in a pip section like "pytorch==1.0"
    // Split on the '=' to separate the packageName and version
    let delimiter = (ecosystem == "pypi") ? "==" : "=";
    let split = dependency.split(delimiter);
    let packageName = split[0];
    // If there is a version specified, use it, otherwise, leave it off. 
    let version = (split.length > 1) ? `@${split[1]}` : "";

    // If it's a PyPI dependency, then normalize the package name
    if (ecosystem == "pypi") {
        packageName = packageName.toLowerCase().replace("_", "-");
    }

    return `pkg:${ecosystem}/${packageName}${version}`;
  }
}