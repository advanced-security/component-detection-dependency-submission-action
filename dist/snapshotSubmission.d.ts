export declare function retrySnapshotSubmission(submit: () => Promise<void>, warn: (message: string) => void, wait?: (milliseconds: number) => Promise<void>): Promise<void>;
