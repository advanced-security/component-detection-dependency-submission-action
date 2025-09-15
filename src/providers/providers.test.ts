import { PlatformProviderFactory, Platform } from './index';
import { GitHubActionsPlatformProvider } from './githubActionsProvider';
import { AzureDevOpsPlatformProvider } from './azureDevOpsProvider';
import ComponentDetection from '../../componentDetection';

describe('PlatformProviderFactory', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear environment variables
    delete process.env.GITHUB_ACTIONS;
    delete process.env.TF_BUILD;
    delete process.env.AGENT_NAME;
    delete process.env.GITHUB_WORKSPACE;
    delete process.env.BUILD_SOURCESDIRECTORY;
    delete process.env.SYSTEM_DEBUG;
    delete process.env.AGENT_JOBNAME;
    delete process.env.SYSTEM_JOBNAME;
    delete process.env.BUILD_BUILDID;
    delete process.env.BUILD_SOURCEVERSION;
    delete process.env.BUILD_SOURCEBRANCH;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Platform Detection', () => {
    test('detects GitHub Actions environment', () => {
      process.env.GITHUB_ACTIONS = 'true';

      const provider = PlatformProviderFactory.create();
      expect(provider).toBeInstanceOf(GitHubActionsPlatformProvider);
    });

    test('detects Azure DevOps environment with TF_BUILD', () => {
      process.env.TF_BUILD = 'True';

      const provider = PlatformProviderFactory.create();
      expect(provider).toBeInstanceOf(AzureDevOpsPlatformProvider);
    });

    test('detects Azure DevOps environment with AGENT_NAME', () => {
      process.env.AGENT_NAME = 'hosted-agent';

      const provider = PlatformProviderFactory.create();
      expect(provider).toBeInstanceOf(AzureDevOpsPlatformProvider);
    });

    test('defaults to GitHub Actions when no environment detected', () => {
      const provider = PlatformProviderFactory.create();
      expect(provider).toBeInstanceOf(GitHubActionsPlatformProvider);
    });

    test('respects explicit platform parameter', () => {
      process.env.GITHUB_ACTIONS = 'true'; // Set GitHub env

      // But explicitly request Azure DevOps
      const provider = PlatformProviderFactory.create(Platform.AzureDevOps);
      expect(provider).toBeInstanceOf(AzureDevOpsPlatformProvider);
    });
  });
});

describe('GitHubActionsPlatformProvider', () => {
  let provider: GitHubActionsPlatformProvider;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    provider = new GitHubActionsPlatformProvider();

    // Set up GitHub environment
    process.env.GITHUB_ACTIONS = 'true';
    process.env.GITHUB_WORKSPACE = '/github/workspace';
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Provider Structure', () => {
    test('has logger provider', () => {
      expect(provider.logger).toBeDefined();
      expect(typeof provider.logger.debug).toBe('function');
      expect(typeof provider.logger.info).toBe('function');
      expect(typeof provider.logger.warning).toBe('function');
      expect(typeof provider.logger.error).toBe('function');
      expect(typeof provider.logger.setFailed).toBe('function');
    });

    test('has input provider', () => {
      expect(provider.input).toBeDefined();
      expect(typeof provider.input.getInput).toBe('function');
      expect(typeof provider.input.getBooleanInput).toBe('function');
    });

    test('has context provider', () => {
      expect(provider.context).toBeDefined();
      expect(typeof provider.context.getRepository).toBe('function');
      expect(typeof provider.context.getJobId).toBe('function');
      expect(typeof provider.context.getRunId).toBe('function');
      expect(typeof provider.context.getSha).toBe('function');
      expect(typeof provider.context.getRef).toBe('function');
      expect(typeof provider.context.getWorkspace).toBe('function');
    });
  });

  describe('Context Provider', () => {
    test('getWorkspace returns GITHUB_WORKSPACE env var', () => {
      const workspace = provider.context.getWorkspace();
      expect(workspace).toBe('/github/workspace');
    });

    test('getWorkspace falls back to cwd when GITHUB_WORKSPACE not set', () => {
      delete process.env.GITHUB_WORKSPACE;
      const workspace = provider.context.getWorkspace();
      expect(workspace).toBe(process.cwd());
    });
  });
});

describe('AzureDevOpsPlatformProvider', () => {
  let provider: AzureDevOpsPlatformProvider;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    provider = new AzureDevOpsPlatformProvider();

    // Set up Azure DevOps environment
    process.env.TF_BUILD = 'True';
    process.env.BUILD_SOURCESDIRECTORY = '/azdo/workspace';
    process.env.INPUT_GITHUBREPOSITORY = 'test-owner/test-repo';
    process.env.INPUT_TOKEN = 'test-token';
    process.env.AGENT_JOBNAME = 'test-azdo-job';
    process.env.BUILD_BUILDID = '789012';
    process.env.BUILD_SOURCEVERSION = 'def456abc789';
    process.env.BUILD_SOURCEBRANCH = 'refs/heads/feature/test';
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Provider Structure', () => {
    test('has logger provider', () => {
      expect(provider.logger).toBeDefined();
      expect(typeof provider.logger.debug).toBe('function');
      expect(typeof provider.logger.info).toBe('function');
      expect(typeof provider.logger.warning).toBe('function');
      expect(typeof provider.logger.error).toBe('function');
      expect(typeof provider.logger.setFailed).toBe('function');
    });

    test('has input provider', () => {
      expect(provider.input).toBeDefined();
      expect(typeof provider.input.getInput).toBe('function');
      expect(typeof provider.input.getBooleanInput).toBe('function');
    });

    test('has context provider', () => {
      expect(provider.context).toBeDefined();
      expect(typeof provider.context.getRepository).toBe('function');
      expect(typeof provider.context.getJobId).toBe('function');
      expect(typeof provider.context.getRunId).toBe('function');
      expect(typeof provider.context.getSha).toBe('function');
      expect(typeof provider.context.getRef).toBe('function');
      expect(typeof provider.context.getWorkspace).toBe('function');
    });
  });

  describe('Input Provider', () => {
    test('getInput reads from INPUT_ prefixed environment variables', () => {
      process.env.INPUT_TESTINPUT = 'test-value';

      const result = provider.input.getInput('testInput');
      expect(result).toBe('test-value');
    });

    test('getInput handles dashes in input names', () => {
      process.env.INPUT_TEST_DASH_INPUT = 'dash-value';

      const result = provider.input.getInput('test-dash-input');
      expect(result).toBe('dash-value');
    });

    test('getInput returns empty string for missing input', () => {
      const result = provider.input.getInput('missing-input');
      expect(result).toBe('');
    });

    test('getInput falls back to GITHUB_TOKEN for token input', () => {
      delete process.env.INPUT_TOKEN;
      process.env.GITHUB_TOKEN = 'fallback-token';

      const result = provider.input.getInput('token');
      expect(result).toBe('fallback-token');
    });

    test('getBooleanInput returns true for "true"', () => {
      process.env.INPUT_TESTBOOL = 'true';

      const result = provider.input.getBooleanInput('testBool');
      expect(result).toBe(true);
    });

    test('getBooleanInput returns true for "1"', () => {
      process.env.INPUT_TESTBOOL = '1';

      const result = provider.input.getBooleanInput('testBool');
      expect(result).toBe(true);
    });

    test('getBooleanInput returns false for other values', () => {
      process.env.INPUT_TESTBOOL = 'false';

      const result = provider.input.getBooleanInput('testBool');
      expect(result).toBe(false);
    });
  });

  describe('Context Provider', () => {
    test('getRepository parses githubRepository input', () => {
      const repo = provider.context.getRepository();
      expect(repo).toEqual({ owner: 'test-owner', repo: 'test-repo' });
    });

    test('getRepository throws error when githubRepository is missing', () => {
      delete process.env.INPUT_GITHUBREPOSITORY;

      expect(() => {
        provider.context.getRepository();
      }).toThrow('githubRepository input is required for Azure DevOps tasks');
    });

    test('getRepository throws error when githubRepository format is invalid', () => {
      process.env.INPUT_GITHUBREPOSITORY = 'invalid-format';

      expect(() => {
        provider.context.getRepository();
      }).toThrow('githubRepository must be in format "owner/repo"');
    });

    test('getJobId returns AGENT_JOBNAME', () => {
      const jobId = provider.context.getJobId();
      expect(jobId).toBe('test-azdo-job');
    });

    test('getJobId falls back to SYSTEM_JOBNAME', () => {
      delete process.env.AGENT_JOBNAME;
      process.env.SYSTEM_JOBNAME = 'system-job';

      const jobId = provider.context.getJobId();
      expect(jobId).toBe('system-job');
    });

    test('getJobId returns unknown-job when no job name available', () => {
      delete process.env.AGENT_JOBNAME;
      delete process.env.SYSTEM_JOBNAME;

      const jobId = provider.context.getJobId();
      expect(jobId).toBe('unknown-job');
    });

    test('getRunId returns parsed BUILD_BUILDID', () => {
      const runId = provider.context.getRunId();
      expect(runId).toBe(789012);
    });

    test('getRunId returns 0 when BUILD_BUILDID is missing', () => {
      delete process.env.BUILD_BUILDID;

      const runId = provider.context.getRunId();
      expect(runId).toBe(0);
    });

    test('getSha returns BUILD_SOURCEVERSION', () => {
      const sha = provider.context.getSha();
      expect(sha).toBe('def456abc789');
    });

    test('getSha returns empty string when BUILD_SOURCEVERSION is missing', () => {
      delete process.env.BUILD_SOURCEVERSION;

      const sha = provider.context.getSha();
      expect(sha).toBe('');
    });

    test('getRef returns BUILD_SOURCEBRANCH', () => {
      const ref = provider.context.getRef();
      expect(ref).toBe('refs/heads/feature/test');
    });

    test('getRef returns main branch when BUILD_SOURCEBRANCH is missing', () => {
      delete process.env.BUILD_SOURCEBRANCH;

      const ref = provider.context.getRef();
      expect(ref).toBe('refs/heads/main');
    });

    test('getWorkspace returns BUILD_SOURCESDIRECTORY', () => {
      const workspace = provider.context.getWorkspace();
      expect(workspace).toBe('/azdo/workspace');
    });

    test('getWorkspace falls back to cwd when BUILD_SOURCESDIRECTORY not set', () => {
      delete process.env.BUILD_SOURCESDIRECTORY;

      const workspace = provider.context.getWorkspace();
      expect(workspace).toBe(process.cwd());
    });
  });
});

describe('Provider Integration with ComponentDetection', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('GitHub Actions Integration', () => {
    beforeEach(() => {
      // Set up GitHub Actions environment
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_WORKSPACE = '/github/workspace';
    });

    test('ComponentDetection can be configured with GitHub Actions provider', () => {
      const provider = PlatformProviderFactory.create(Platform.GitHubActions);
      ComponentDetection.setPlatformProvider(provider);

      expect(provider).toBeInstanceOf(GitHubActionsPlatformProvider);
      expect(provider.logger).toBeDefined();
      expect(provider.input).toBeDefined();
      expect(provider.context).toBeDefined();
    });

    test('GitHub Actions provider provides expected context for dependency submission', () => {
      const provider = PlatformProviderFactory.create(Platform.GitHubActions);

      const workspace = provider.context.getWorkspace();
      expect(workspace).toBeTruthy();
      expect(typeof workspace).toBe('string');
    });
  });

  describe('Azure DevOps Integration', () => {
    beforeEach(() => {
      // Set up Azure DevOps environment
      process.env.TF_BUILD = 'True';
      process.env.BUILD_SOURCESDIRECTORY = '/azdo/workspace';
      process.env.INPUT_GITHUBREPOSITORY = 'test-owner/test-repo';
      process.env.BUILD_SOURCEVERSION = 'abc123';
      process.env.BUILD_SOURCEBRANCH = 'refs/heads/main';
      process.env.BUILD_BUILDID = '12345';
    });

    test('ComponentDetection can be configured with Azure DevOps provider', () => {
      const provider = PlatformProviderFactory.create(Platform.AzureDevOps);
      ComponentDetection.setPlatformProvider(provider);

      expect(provider).toBeInstanceOf(AzureDevOpsPlatformProvider);
      expect(provider.logger).toBeDefined();
      expect(provider.input).toBeDefined();
      expect(provider.context).toBeDefined();
    });

    test('Azure DevOps provider provides expected context for dependency submission', () => {
      const provider = PlatformProviderFactory.create(Platform.AzureDevOps);

      const repo = provider.context.getRepository();
      expect(repo.owner).toBe('test-owner');
      expect(repo.repo).toBe('test-repo');

      const sha = provider.context.getSha();
      expect(sha).toBe('abc123');

      const ref = provider.context.getRef();
      expect(ref).toBe('refs/heads/main');

      const workspace = provider.context.getWorkspace();
      expect(workspace).toBe('/azdo/workspace');

      const runId = provider.context.getRunId();
      expect(runId).toBe(12345);
    });

    test('Azure DevOps provider handles missing GitHub repository gracefully', () => {
      delete process.env.INPUT_GITHUBREPOSITORY;

      const provider = PlatformProviderFactory.create(Platform.AzureDevOps);

      expect(() => {
        provider.context.getRepository();
      }).toThrow('githubRepository input is required for Azure DevOps tasks');
    });
  });

  describe('Cross-Platform Compatibility', () => {
    test('both providers implement the same interface', () => {
      const githubProvider = PlatformProviderFactory.create(Platform.GitHubActions);
      process.env.INPUT_GITHUBREPOSITORY = 'test/repo'; // Set this for Azure provider
      const azureProvider = PlatformProviderFactory.create(Platform.AzureDevOps);

      // Both should have the same interface methods
      expect(typeof githubProvider.logger.debug).toBe('function');
      expect(typeof githubProvider.logger.info).toBe('function');
      expect(typeof githubProvider.logger.warning).toBe('function');
      expect(typeof githubProvider.logger.error).toBe('function');
      expect(typeof githubProvider.logger.setFailed).toBe('function');

      expect(typeof githubProvider.input.getInput).toBe('function');
      expect(typeof githubProvider.input.getBooleanInput).toBe('function');

      expect(typeof githubProvider.context.getRepository).toBe('function');
      expect(typeof githubProvider.context.getJobId).toBe('function');
      expect(typeof githubProvider.context.getRunId).toBe('function');
      expect(typeof githubProvider.context.getSha).toBe('function');
      expect(typeof githubProvider.context.getRef).toBe('function');
      expect(typeof githubProvider.context.getWorkspace).toBe('function');

      // Azure provider should have the same interface
      expect(typeof azureProvider.logger.debug).toBe('function');
      expect(typeof azureProvider.logger.info).toBe('function');
      expect(typeof azureProvider.logger.warning).toBe('function');
      expect(typeof azureProvider.logger.error).toBe('function');
      expect(typeof azureProvider.logger.setFailed).toBe('function');

      expect(typeof azureProvider.input.getInput).toBe('function');
      expect(typeof azureProvider.input.getBooleanInput).toBe('function');

      expect(typeof azureProvider.context.getRepository).toBe('function');
      expect(typeof azureProvider.context.getJobId).toBe('function');
      expect(typeof azureProvider.context.getRunId).toBe('function');
      expect(typeof azureProvider.context.getSha).toBe('function');
      expect(typeof azureProvider.context.getRef).toBe('function');
      expect(typeof azureProvider.context.getWorkspace).toBe('function');
    });

    test('both providers return consistent data types', () => {
      // Set up environments for both
      process.env.GITHUB_ACTIONS = 'true';
      process.env.TF_BUILD = 'True';
      process.env.INPUT_GITHUBREPOSITORY = 'test-owner/test-repo';
      process.env.BUILD_BUILDID = '12345';

      const githubProvider = PlatformProviderFactory.create(Platform.GitHubActions);
      const azureProvider = PlatformProviderFactory.create(Platform.AzureDevOps);

      // Repository should be an object with owner and repo
      const azureRepo = azureProvider.context.getRepository();

      expect(typeof azureRepo.owner).toBe('string');
      expect(typeof azureRepo.repo).toBe('string');

      // RunId should be a number
      expect(typeof githubProvider.context.getRunId()).toBe('number');
      expect(typeof azureProvider.context.getRunId()).toBe('number');

      // Other fields should be strings (or undefined for GitHub job id in test environment)
      const githubJobId = githubProvider.context.getJobId();
      expect(typeof githubJobId === 'string' || typeof githubJobId === 'undefined').toBe(true);
      expect(typeof azureProvider.context.getJobId()).toBe('string');

      // SHA might be undefined for GitHub in test environment
      const githubSha = githubProvider.context.getSha();
      expect(typeof githubSha === 'string' || typeof githubSha === 'undefined').toBe(true);
      expect(typeof azureProvider.context.getSha()).toBe('string');

      // Ref might be undefined for GitHub in test environment
      const githubRef = githubProvider.context.getRef();
      expect(typeof githubRef === 'string' || typeof githubRef === 'undefined').toBe(true);
      expect(typeof azureProvider.context.getRef()).toBe('string');

      expect(typeof githubProvider.context.getWorkspace()).toBe('string');
      expect(typeof azureProvider.context.getWorkspace()).toBe('string');
    });
  });
});