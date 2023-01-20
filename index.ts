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

import CondaParser from './condaParser';

async function run() {
  let manifests = CondaParser.getManifestsFromEnvironmentFiles(
    CondaParser.searchFiles(core.getInput('filePath'), core.getInput('filePattern')));
  
  let snapshot = new Snapshot({
      name: "conda-dependency-submission-action",
      version: "0.0.1",
      url: "https://github.com/jhutchings1/conda-dependency-submission-action",
  }, 
  github.context,
  {
    correlator:`${github.context.job}`,
    id: github.context.runId.toString()
  });

  manifests?.forEach(manifest => {
    snapshot.addManifest(manifest);
  });

  submitSnapshot(snapshot);
}

run();
