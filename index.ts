import {
  PackageCache,
  BuildTarget,
  Package,
  Snapshot,
  Manifest,
  submitSnapshot
} from '@github/dependency-submission-toolkit';

import ComponentDetection from './componentDetection';
import { PlatformProviderFactory, Platform } from './src/providers';

async function run() {
  try {
    console.log('Creating platform provider...');
    const platform = PlatformProviderFactory.create();
    console.log(`Platform created: ${typeof platform}`);

    if (!platform) {
      throw new Error('Failed to create platform provider');
    }

    if (!platform.context) {
      throw new Error('Platform provider created but context is undefined');
    }

    if (!platform.input) {
      throw new Error('Platform provider created but input is undefined');
    }

    if (!platform.logger) {
      throw new Error('Platform provider created but logger is undefined');
    }

    console.log(`Platform has context: ${!!platform.context}`);
    console.log(`Platform has input: ${!!platform.input}`);
    console.log(`Platform has logger: ${!!platform.logger}`);

    // Test the context methods
    try {
      const repo = platform.context.getRepository();
      console.log(`Repository: ${JSON.stringify(repo)}`);
    } catch (error) {
      console.error(`Failed to get repository from context: ${error}`);
      throw new Error(`Invalid platform context - cannot get repository: ${error}`);
    }

    let manifests = await ComponentDetection.scanAndGetManifests(
    platform.input.getInput("filePath"),
    platform
    );

    let correlatorInput: string;
    try {
      correlatorInput = platform.input.getInput("correlator")?.trim() || platform.context.getJobId();
      console.log(`Correlator input: ${correlatorInput}`);
      if (!correlatorInput) {
        throw new Error('Could not obtain correlator input or job ID');
      }
    } catch (error) {
      console.error(`Failed to get correlator input: ${error}`);
      throw new Error(`Cannot proceed without correlator input: ${error}`);
    }  // Get detector configuration inputs
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

  if (process.env.GITHUB_ACTIONS === 'true') {
    // We're in GitHub Actions, use the actual github context
    try {
      platform.logger.debug('Attempting to import @actions/github');
      const githubModule = await import('@actions/github');
      platform.logger.debug(`GitHub module imported: ${typeof githubModule}`);
      platform.logger.debug(`GitHub module keys: ${Object.keys(githubModule)}`);

      const { default: github } = githubModule;
      platform.logger.debug(`GitHub default export: ${typeof github}`);

      if (!github) {
        throw new Error('GitHub module default export is undefined');
      }

      if (!github.context) {
        throw new Error('GitHub context is undefined');
      }

      platform.logger.debug(`GitHub context keys: ${Object.keys(github.context)}`);
      platform.logger.debug(`GitHub context repo: ${JSON.stringify(github.context.repo)}`);
      platform.logger.debug(`GitHub context job: ${github.context.job}`);
      platform.logger.debug(`GitHub context runId: ${github.context.runId}`);
      platform.logger.debug(`GitHub context sha: ${github.context.sha}`);
      platform.logger.debug(`GitHub context ref: ${github.context.ref}`);

      snapshot = new Snapshot(detector, github.context, {
        correlator: correlatorInput,
        id: platform.context.getRunId().toString(),
      });
    } catch (error) {
      platform.logger.error(`Failed to use GitHub Actions context: ${error}`);
      platform.logger.setFailed(`Cannot proceed without valid GitHub Actions context: ${error}`);
      return;
    }
  } else {
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

    snapshot = new Snapshot(detector, mockContext as any, {
      correlator: correlatorInput,
      id: platform.context.getRunId().toString(),
    });
  }

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

  submitSnapshot(snapshot);
  } catch (error) {
    console.error('Error in run function:', error);
    throw error;
  }
}

run();
