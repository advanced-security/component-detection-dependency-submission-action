// Note: Import azure-pipelines-task-lib when building for ADO
// For now, we'll use process.env and console for basic functionality
// import * as tl from 'azure-pipelines-task-lib/task';
import { ILoggerProvider, IInputProvider, IContextProvider, IPlatformProvider } from './interfaces';

export class AzureDevOpsLoggerProvider implements ILoggerProvider {
  debug(message: string): void {
    if (process.env.SYSTEM_DEBUG === 'true') {
      console.log(`##[debug]${message}`);
    }
  }

  info(message: string): void {
    console.log(message);
  }

  warning(message: string): void {
    console.log(`##[warning]${message}`);
  }

  error(message: string | Error): void {
    const errorMessage = message instanceof Error ? message.message : message;
    console.log(`##[error]${errorMessage}`);
  }

  setFailed(message: string): void {
    console.log(`##[error]${message}`);
    process.exit(1);
  }
}

export class AzureDevOpsInputProvider implements IInputProvider {
  getInput(name: string): string {
    // ADO task inputs are available as environment variables with INPUT_ prefix
    const envName = `INPUT_${name.toUpperCase().replace(/-/g, '_')}`;
    const value = process.env[envName] || '';

    // Special handling for token input - also check GITHUB_TOKEN for backward compatibility
    if (name === 'token' && !value) {
      return process.env['GITHUB_TOKEN'] || '';
    }

    return value;
  }

  getBooleanInput(name: string): boolean {
    const value = this.getInput(name).toLowerCase();
    return value === 'true' || value === '1';
  }
}

export class AzureDevOpsContextProvider implements IContextProvider {
  getRepository(): { owner: string; repo: string } {
    // For ADO, we need to get GitHub org/repo from task inputs since we're submitting to GitHub
    const githubRepo = new AzureDevOpsInputProvider().getInput('githubRepository');
    if (!githubRepo) {
      throw new Error('githubRepository input is required for Azure DevOps tasks');
    }

    const [owner, repo] = githubRepo.split('/');
    if (!owner || !repo) {
      throw new Error('githubRepository must be in format "owner/repo"');
    }

    return { owner, repo };
  }

  getJobId(): string {
    return process.env.AGENT_JOBNAME || process.env.SYSTEM_JOBNAME || 'unknown-job';
  }

  getRunId(): number {
    // Use build ID as equivalent to GitHub run ID
    const buildId = process.env.BUILD_BUILDID;
    return buildId ? parseInt(buildId, 10) : 0;
  }

  getSha(): string {
    // Get the commit SHA from Azure DevOps variables
    return process.env.BUILD_SOURCEVERSION || '';
  }

  getRef(): string {
    // Get the branch reference from Azure DevOps variables
    const sourceBranch = process.env.BUILD_SOURCEBRANCH;
    return sourceBranch || 'refs/heads/main';
  }

  getWorkspace(): string {
    return process.env.BUILD_SOURCESDIRECTORY || process.cwd();
  }
}

export class AzureDevOpsPlatformProvider implements IPlatformProvider {
  public readonly logger: ILoggerProvider;
  public readonly input: IInputProvider;
  public readonly context: IContextProvider;

  constructor() {
    this.logger = new AzureDevOpsLoggerProvider();
    this.input = new AzureDevOpsInputProvider();
    this.context = new AzureDevOpsContextProvider();
  }
}
