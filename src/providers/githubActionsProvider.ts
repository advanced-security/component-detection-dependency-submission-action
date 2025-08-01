import * as core from '@actions/core';
import * as github from '@actions/github';
import { ILoggerProvider, IInputProvider, IContextProvider, IPlatformProvider } from './interfaces';

export class GitHubActionsLoggerProvider implements ILoggerProvider {
  debug(message: string): void {
    core.debug(message);
  }

  info(message: string): void {
    core.info(message);
  }

  warning(message: string): void {
    core.warning(message);
  }

  error(message: string | Error): void {
    core.error(message);
  }

  setFailed(message: string): void {
    core.setFailed(message);
  }
}

export class GitHubActionsInputProvider implements IInputProvider {
  getInput(name: string): string {
    return core.getInput(name);
  }

  getBooleanInput(name: string): boolean {
    return core.getBooleanInput(name);
  }
}

export class GitHubActionsContextProvider implements IContextProvider {
  getRepository(): { owner: string; repo: string } {
    return {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo
    };
  }

  getJobId(): string {
    return github.context.job;
  }

  getRunId(): number {
    return github.context.runId;
  }

  getSha(): string {
    return github.context.sha;
  }

  getRef(): string {
    return github.context.ref;
  }

  getWorkspace(): string {
    return process.env.GITHUB_WORKSPACE || process.cwd();
  }
}

export class GitHubActionsPlatformProvider implements IPlatformProvider {
  public readonly logger: ILoggerProvider;
  public readonly input: IInputProvider;
  public readonly context: IContextProvider;

  constructor() {
    this.logger = new GitHubActionsLoggerProvider();
    this.input = new GitHubActionsInputProvider();
    this.context = new GitHubActionsContextProvider();
  }
}
