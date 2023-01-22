import { Manifest } from '@github/dependency-submission-toolkit';
export default class ComponentDetection {
    protected static componentDetectionPath: string;
    protected static outputPath: string;
    static scanAndGetManifests(path: string): Promise<Manifest[] | undefined>;
    private static downloadLatestRelease;
    private static runComponentDetection;
    private static getComponentDetectionParameters;
    private static getManifestsFromResults;
    private static getDependencyScope;
    private static makePackageUrl;
    private static getLatestReleaseURL;
}
