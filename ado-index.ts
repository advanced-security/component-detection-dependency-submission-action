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
    // Validate required inputs
    const githubRepository = platform.input.getInput("githubRepository");
    const githubToken = platform.input.getInput("token");

    if (!githubRepository) {
      platform.logger.setFailed("githubRepository input is required. Please provide the GitHub repository in format 'owner/repo'");
      return;
    }

    if (!githubToken) {
      platform.logger.setFailed("token input is required. Please provide a GitHub Personal Access Token with 'Contents' repository permissions");
      return;
    }

    platform.logger.debug(`GitHub Repository: ${githubRepository}`);
    platform.logger.debug(`GitHub Token provided: ${githubToken ? 'Yes' : 'No'}`);

    // Set the GitHub token in environment for dependency-submission-toolkit
    process.env.GITHUB_TOKEN = githubToken;
    // Also set other environment variables that the toolkit might expect
    process.env.GITHUB_REPOSITORY = githubRepository;
    process.env.GITHUB_API_URL = 'https://api.github.com';

    // The dependency-submission-toolkit might expect these GitHub Actions environment variables
    process.env.GITHUB_SERVER_URL = 'https://github.com';
    process.env.GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

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

    if (!manifests || manifests.length === 0) {
      platform.logger.warning("No manifests found. Skipping dependency submission.");
      return;
    }

    platform.logger.info(`Submitting snapshot with ${snapshot.manifests.size} manifests to GitHub repository: ${repo.owner}/${repo.repo}`);
    platform.logger.debug(`Snapshot SHA: ${snapshot.sha}`);
    platform.logger.debug(`Snapshot Ref: ${snapshot.ref}`);
    platform.logger.debug(`Correlator: ${correlatorInput}`);

    // Submit snapshot to GitHub (using the provided GitHub token)
    try {
      await submitSnapshot(snapshot);
      platform.logger.info("Component detection and dependency submission completed successfully");
    } catch (submissionError: any) {
      platform.logger.error(`Failed to submit snapshot to GitHub: ${submissionError.message}`);
      if (submissionError.response) {
        platform.logger.error(`HTTP Status: ${submissionError.response.status}`);
        platform.logger.error(`Response: ${JSON.stringify(submissionError.response.data)}`);
      }
      if (submissionError.stack) {
        platform.logger.debug(`Stack trace: ${submissionError.stack}`);
      }
      throw submissionError;
    }
  } catch (error: any) {
    platform.logger.setFailed(`Component detection failed: ${error.message}`);
  }
}

run().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
