import { ILoggerProvider, IInputProvider, IContextProvider, IPlatformProvider, Platform } from './interfaces';
export declare class GitHubActionsLoggerProvider implements ILoggerProvider {
    debug(message: string): void;
    info(message: string): void;
    warning(message: string): void;
    error(message: string | Error): void;
    setFailed(message: string): void;
}
export declare class GitHubActionsInputProvider implements IInputProvider {
    getInput(name: string): string;
    getBooleanInput(name: string): boolean;
}
export declare class GitHubActionsContextProvider implements IContextProvider {
    getRepository(): {
        owner: string;
        repo: string;
    };
    getJobId(): string;
    getRunId(): number;
    getSha(): string;
    getRef(): string;
    getWorkspace(): string;
}
export declare class GitHubActionsPlatformProvider implements IPlatformProvider {
    readonly logger: ILoggerProvider;
    readonly input: IInputProvider;
    readonly context: IContextProvider;
    readonly platform: Platform;
    constructor();
}
