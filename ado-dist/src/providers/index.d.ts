import { IPlatformProvider, Platform } from './interfaces';
export declare class PlatformProviderFactory {
    static create(platform?: Platform): IPlatformProvider;
    private static detectPlatform;
}
export * from './interfaces';
export * from './githubActionsProvider';
export * from './azureDevOpsProvider';
