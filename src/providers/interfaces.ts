/**
 * Platform abstraction interfaces for GitHub Actions vs Azure DevOps
 */

export interface ILoggerProvider {
  debug(message: string): void;
  info(message: string): void;
  warning(message: string): void;
  error(message: string | Error): void;
  setFailed(message: string): void;
}

export interface IInputProvider {
  getInput(name: string): string;
  getBooleanInput(name: string): boolean;
}

export interface IContextProvider {
  getRepository(): { owner: string; repo: string };
  getJobId(): string;
  getRunId(): number;
  getSha(): string;
  getRef(): string;
  getWorkspace(): string;
}

export interface IPlatformProvider {
  logger: ILoggerProvider;
  input: IInputProvider;
  context: IContextProvider;
}

export enum Platform {
  GitHubActions = 'github-actions',
  AzureDevOps = 'azure-devops'
}
