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
  let manifests = await ComponentDetection.scanAndGetManifests(
    core.getInput("filePath")
  );
  const correlatorInput =
    core.getInput("correlator")?.trim() || github.context.job;

  // Get detector configuration inputs
  const detectorName = core.getInput("detector-name")?.trim();
  const detectorVersion = core.getInput("detector-version")?.trim();
  const detectorUrl = core.getInput("detector-url")?.trim();

  // Validate that if any detector config is provided, all must be provided
  const hasAnyDetectorInput = detectorName || detectorVersion || detectorUrl;
  const hasAllDetectorInputs = detectorName && detectorVersion && detectorUrl;

  if (hasAnyDetectorInput && !hasAllDetectorInputs) {
    core.setFailed(
      "If any detector configuration is provided (detector-name, detector-version, detector-url), all three must be provided."
    );
    return;
  }

  // Use provided detector config or defaults
  const detector = hasAllDetectorInputs
    ? {
        name: detectorName,
        version: detectorVersion,
        url: detectorUrl,
      }
    : {
        name: "Component Detection",
        version: "0.0.1",
        url: "https://github.com/advanced-security/component-detection-dependency-submission-action",
      };

  let snapshot = new Snapshot(detector, github.context, {
    correlator: correlatorInput,
    id: github.context.runId.toString(),
  });

  core.debug(`Manifests: ${manifests?.length}`);

  manifests?.forEach((manifest) => {
    core.debug(`Manifest: ${JSON.stringify(manifest)}`);
    snapshot.addManifest(manifest);
  });

  // Override snapshot ref and sha if provided
  const snapshotSha = core.getInput("snapshot-sha")?.trim();
  const snapshotRef = core.getInput("snapshot-ref")?.trim();

  if (snapshotSha) {
    snapshot.sha = snapshotSha;
  }

  if (snapshotRef) {
    snapshot.ref = snapshotRef;
  }

  submitSnapshot(snapshot);
}

run();
