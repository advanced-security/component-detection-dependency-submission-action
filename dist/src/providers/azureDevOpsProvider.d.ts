import { ILoggerProvider, IInputProvider, IContextProvider, IPlatformProvider } from './interfaces';
export declare class AzureDevOpsLoggerProvider implements ILoggerProvider {
    debug(message: string): void;
    info(message: string): void;
    warning(message: string): void;
    error(message: string | Error): void;
    setFailed(message: string): void;
}
export declare class AzureDevOpsInputProvider implements IInputProvider {
    getInput(name: string): string;
    getBooleanInput(name: string): boolean;
}
export declare class AzureDevOpsContextProvider implements IContextProvider {
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
export declare class AzureDevOpsPlatformProvider implements IPlatformProvider {
    readonly logger: ILoggerProvider;
    readonly input: IInputProvider;
    readonly context: IContextProvider;
    constructor();
}
