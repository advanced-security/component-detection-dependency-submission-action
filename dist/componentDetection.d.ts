import { Manifest } from '@github/dependency-submission-toolkit';
export default class ComponentDetection {
    static componentDetectionPath: string;
    static outputPath: string;
    static scanAndGetManifests(path: string): Promise<Manifest[] | undefined>;
    static downloadLatestRelease(): Promise<void>;
    static runComponentDetection(path: string): Promise<void>;
    private static getComponentDetectionParameters;
    static getManifestsFromResults(): Promise<Manifest[] | undefined>;
    private static getDependencyScope;
    private static makePackageUrl;
    private static getLatestReleaseURL;
}
