export default class ComponentDetection {
    static componentDetectionPath: string;
    static outputPath: string;
    static scanAndGetManifests(path: string): Promise<any[] | undefined>;
    static downloadLatestRelease(): Promise<void>;
    static runComponentDetection(path: string): Promise<void>;
    private static getComponentDetectionParameters;
    static getManifestsFromResults(): Promise<any[] | undefined>;
    private static getDependencyScope;
    static makePackageUrl(packageUrlJson: any): string;
    private static getLatestReleaseURL;
}
