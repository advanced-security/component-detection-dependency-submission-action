const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const glob = require('glob');
const yaml = require('yaml');

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

        static getManifestsFromEnvironmentFiles(files:string[]) {
            core.debug(`Processing ${files.length} files`);
            let manifests: any[] = [];
            files?.forEach(filePath => {
                core.debug(`Processing ${filePath}`);
                const contents = fs.readFileSync(filePath, 'utf8')
                manifests.push(yaml.parse(contents));
            });
            return manifests;
        }

        static getManifestFromYaml(yaml:any) {
            
        }
}