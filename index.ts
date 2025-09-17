import {
  Snapshot,
  submitSnapshot
} from '@github/dependency-submission-toolkit';

import ComponentDetection from './componentDetection';
import { PlatformProviderFactory, Platform } from './src/providers';

async function run() {
  const platform = PlatformProviderFactory.create();
  try {

    if (!platform || !platform.context || !platform.input || !platform.logger) {
      throw new Error(`Failed to create platform provider with required components - platform: ${!!platform}, context: ${!!platform?.context}, input: ${!!platform?.input}, logger: ${!!platform?.logger}`);
    }

    // ADO-specific validation and setup
    if (platform.platform === Platform.AzureDevOps) {
      // Log debug environment status for troubleshooting
      platform.logger.info(`[Debug Environment] SYSTEM_DEBUG: ${process.env.SYSTEM_DEBUG}, RUNNER_DEBUG: ${process.env.RUNNER_DEBUG}, DEBUG: ${process.env.DEBUG}`);

      // We're in Azure DevOps, validate required inputs
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

      // Set expectations for dependency-submission-toolkit (GHEC)
      process.env.GITHUB_TOKEN = githubToken;
      process.env.GITHUB_REPOSITORY = githubRepository;
      process.env.GITHUB_API_URL = 'https://api.github.com';
      process.env.GITHUB_SERVER_URL = 'https://github.com';
      process.env.GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
    }

    let manifests = await ComponentDetection.scanAndGetManifests(
      platform.input.getInput("filePath") || ".",
      platform
    );

    const correlatorInput = platform.input.getInput("correlator")?.trim() || platform.context.getJobId();

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

    // Create snapshot with context appropriate for the platform
    let snapshot: Snapshot;

    // Get repository info once (works for both platforms)
    const repo = platform.context.getRepository();

    if (platform.platform === Platform.GitHubActions) {
      // We're in GitHub Actions, use the actual github context
      try {
        const githubModule = await import('@actions/github');
        const { context } = githubModule;

        if (!context) {
          throw new Error('GitHub context is undefined');
        }

        snapshot = new Snapshot(detector, context, {
          correlator: correlatorInput,
          id: platform.context.getRunId().toString(),
        });
      } catch (error) {
        platform.logger.error(`Failed to use GitHub Actions context: ${error}`);
        platform.logger.setFailed(`Cannot proceed without valid GitHub Actions context: ${error}`);
        return;
      }
    } else if (platform.platform === Platform.AzureDevOps) {
      // Create a minimal GitHub context for ADO since dependency-submission-toolkit requires it
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

      snapshot = new Snapshot(detector, mockContext as any, {
        correlator: correlatorInput,
        id: platform.context.getRunId().toString(),
      });
    } else {
      platform.logger.setFailed(`Unsupported platform: ${platform.platform}`);
      return;
    }

    // Debug snapshot creation
    platform.logger.debug(`Snapshot created. Manifests property type: ${typeof snapshot.manifests}, value: ${snapshot.manifests}`);
    platform.logger.debug(`Manifests to add: ${manifests?.length}`);

    manifests?.forEach((manifest) => {
      platform.logger.debug(`Manifest: ${JSON.stringify(manifest)}`);
      snapshot.addManifest(manifest);
    });

    // Debug snapshot after adding manifests
    platform.logger.debug(`After adding manifests - Snapshot manifests count: ${snapshot.manifests?.size || snapshot.manifests?.length || 'unknown'}`);

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

    // Log manifest count and snapshot details before submission
    const manifestCount = manifests?.length || 0;
    const snapshotManifestCount = snapshot.manifests?.size || snapshot.manifests?.length || 'unknown';

    platform.logger.info(`Submitting snapshot with ${manifestCount} manifests (snapshot has ${snapshotManifestCount}) to GitHub repository: ${repo.owner}/${repo.repo}`);
    platform.logger.debug(`Snapshot - SHA: ${snapshot.sha}, Ref: ${snapshot.ref}, Correlator: ${correlatorInput}`);
    platform.logger.debug(`Snapshot manifests type: ${typeof snapshot.manifests}, constructor: ${snapshot.manifests?.constructor?.name}`);

    // Submit snapshot to GitHub (using the provided GitHub token)
    try {
      await submitSnapshot(snapshot);
      platform.logger.info("Component detection and dependency submission completed successfully");
    } catch (submissionError: any) {
      platform.logger.error(`Failed to submit snapshot to GitHub: ${submissionError.message}`);
      if (submissionError.response) {
        platform.logger.error(`HTTP Status: ${submissionError.response.status}, Response: ${JSON.stringify(submissionError.response.data)}`);
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
