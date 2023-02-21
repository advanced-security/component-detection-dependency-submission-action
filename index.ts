import * as core from '@actions/core';
import * as github from '@actions/github';

import {
  PackageCache,
  BuildTarget,
  Package,
  Snapshot,
  Manifest,
  submitSnapshot
} from '@github/dependency-submission-toolkit';

import ComponentDetection from './componentDetection';

async function run() {
  let manifests = await ComponentDetection.scanAndGetManifests(core.getInput('filePath'));
  
  let snapshot = new Snapshot({
      name: "Component Detection",
      version: "0.0.1",
      url: "https://github.com/advanced-security/component-detection-dependency-submission-action",
  }, 
  github.context,
  {
    correlator:`${github.context.job}`,
    id: github.context.runId.toString()
  });

  core.debug(`Manifests: ${manifests?.length}`);

  manifests?.forEach(manifest => {
    core.debug(`Manifest: ${JSON.stringify(manifest)}`);
    snapshot.addManifest(manifest);
  });

  submitSnapshot(snapshot);
}

run();
