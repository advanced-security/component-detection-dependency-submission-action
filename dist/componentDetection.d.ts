import { Manifest } from '@github/dependency-submission-toolkit';
export default class ComponentDetection {
    static componentDetectionPath: string;
    static outputPath: string;
    static scanAndGetManifests(path: string): Promise<Manifest[] | undefined>;
    static downloadLatestRelease(): Promise<void>;
    static runComponentDetection(path: string): Promise<void>;
    private static getComponentDetectionParameters;
    static getManifestsFromResults(): Promise<Manifest[] | undefined>;
    static processComponentsToManifests(componentsFound: any[]): Manifest[];
    private static addPackagesToManifests;
    private static getDependencyScope;
    static makePackageUrl(packageUrlJson: any): string;
    private static getLatestReleaseURL;
}
