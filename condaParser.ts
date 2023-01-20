const core = require('@actions/core');
const github = require('@actions/github');
const glob = require('glob');
const yaml = require('yaml');

import * as fs from 'fs';

import {
  PackageCache,
  BuildTarget,
  Package,
  Snapshot,
  Manifest,
  submitSnapshot
} from '@github/dependency-submission-toolkit'
import { YAMLMap } from 'yaml';

/**getManifestFromEnvironmentFile(document, fileName) {
core.debug(`getManifestFromEnvironmentFile processing ${fileName}`);

let manifest = new Manifest("Environment", fileName);


/** 
 let manifest = new Manifest(document.name, fileName);

core.debug(`Processing ${document.packages?.length} packages`);

document.packages?.forEach(pkg => {
    let packageName = pkg.name;
    let packageVersion = pkg.packageVersion;
    let referenceLocator = pkg.externalRefs?.find(ref => ref.referenceCategory === "PACKAGE-MANAGER" && ref.referenceType === "purl")?.referenceLocator;
    let genericPurl = `pkg:generic/${packageName}@${packageVersion}`;
    // SPDX 2.3 defines a purl field 
    let purl;
    if (pkg.purl != undefined) {
    purl = pkg.purl;
    } else if (referenceLocator != undefined) {
    purl = referenceLocator;
    } else {
    purl = genericPurl;
    }  

    // Working around weird encoding issues from an SBOM generator
    // Find the last instance of %40 and replace it with @
    purl = replaceVersionEscape(purl);  

    let relationships = document.relationships?.find(rel => rel.relatedSpdxElement == pkg.SPDXID && rel.relationshipType == "DEPENDS_ON" && rel.spdxElementId != "SPDXRef-RootPackage");
    if (relationships != null && relationships.length > 0) {
    manifest.addIndirectDependency(new Package(purl));
    } else {
    manifest.addDirectDependency(new Package(purl));
    }
});
return manifest;
}*/

/***/

export default class CondaParser {

  static searchFiles(filePath = "", filePattern = "") {
    if (filePath == "") {
        let filePath = core.getInput('filePath');
    }
    if (filePattern == "") {
        let filePattern = core.getInput('filePattern');
    }

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