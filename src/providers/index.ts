import { IPlatformProvider, Platform } from './interfaces';
import { GitHubActionsPlatformProvider } from './githubActionsProvider';
import { AzureDevOpsPlatformProvider } from './azureDevOpsProvider';

export class PlatformProviderFactory {
  static create(platform?: Platform): IPlatformProvider {
    // Auto-detect platform if not specified
    if (!platform) {
      platform = PlatformProviderFactory.detectPlatform();
    }

    switch (platform) {
      case Platform.GitHubActions:
        return new GitHubActionsPlatformProvider();
      case Platform.AzureDevOps:
        return new AzureDevOpsPlatformProvider();
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private static detectPlatform(): Platform {
    // Check for GitHub Actions environment
    if (process.env.GITHUB_ACTIONS === 'true') {
      return Platform.GitHubActions;
    }

    // Check for Azure DevOps environment
    if (process.env.TF_BUILD === 'True' || process.env.AGENT_NAME) {
      return Platform.AzureDevOps;
    }

    // Default to GitHub Actions if we can't detect
    return Platform.GitHubActions;
  }
}

export * from './interfaces';
export * from './githubActionsProvider';
export * from './azureDevOpsProvider';
