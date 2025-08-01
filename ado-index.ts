import ComponentDetection from './componentDetection';
import { PlatformProviderFactory, Platform } from './src/providers';
import {
  PackageCache,
  BuildTarget,
  Package,
  Snapshot,
  Manifest,
  submitSnapshot
} from '@github/dependency-submission-toolkit';

async function run() {
  const platform = PlatformProviderFactory.create(Platform.AzureDevOps);

  try {
    let manifests = await ComponentDetection.scanAndGetManifests(
      platform.input.getInput("filePath") || ".",
      platform
    );

    const correlatorInput =
      platform.input.getInput("correlator")?.trim() || platform.context.getJobId();

    // Get detector configuration inputs
    const detectorName = platform.input.getInput("detector-name")?.trim();
    const detectorVersion = platform.input.getInput("detector-version")?.trim();
    const detectorUrl = platform.input.getInput("detector-url")?.trim();

    // Validate that if any detector config is provided, all must be provided
    const hasAnyDetectorInput = detectorName || detectorVersion || detectorUrl;
    const hasAllDetectorInputs = detectorName && detectorVersion && detectorUrl;

    if (hasAnyDetectorInput && !hasAllDetectorInputs) {
      platform.logger.setFailed(
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

    // For ADO, we need to construct a minimal context object
    // The dependency-submission-toolkit uses GitHub API, so we need GitHub org/repo
    const repo = platform.context.getRepository();

    // Create a minimal context that satisfies the Snapshot constructor
    const mockContext = {
      repo,
      runId: platform.context.getRunId(),
      sha: platform.context.getSha(),
      ref: platform.context.getRef(),
      workflow: platform.context.getJobId(),
      job: platform.context.getJobId(),
      actor: 'azure-devops',
      action: 'component-detection',
      runAttempt: 1,
      runNumber: platform.context.getRunId(),
      apiUrl: 'https://api.github.com',
      graphqlUrl: 'https://api.github.com/graphql',
      serverUrl: 'https://github.com',
      payload: {},
      issue: {},
      eventName: 'push'
    };

    let snapshot = new Snapshot(detector, mockContext as any, {
      correlator: correlatorInput,
      id: platform.context.getRunId().toString(),
    });

    platform.logger.debug(`Manifests: ${manifests?.length}`);

    manifests?.forEach((manifest) => {
      platform.logger.debug(`Manifest: ${JSON.stringify(manifest)}`);
      snapshot.addManifest(manifest);
    });

    // Override snapshot ref and sha if provided
    const snapshotSha = platform.input.getInput("snapshot-sha")?.trim();
    const snapshotRef = platform.input.getInput("snapshot-ref")?.trim();

    if (snapshotSha) {
      snapshot.sha = snapshotSha;
    }

    if (snapshotRef) {
      snapshot.ref = snapshotRef;
    }

    // Submit snapshot to GitHub (using the provided GitHub token)
    await submitSnapshot(snapshot);

    platform.logger.info("Component detection and dependency submission completed successfully");
  } catch (error: any) {
    platform.logger.setFailed(`Component detection failed: ${error.message}`);
  }
}

run().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
