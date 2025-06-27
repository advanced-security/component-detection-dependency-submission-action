import { Manifest } from '@github/dependency-submission-toolkit';
export default class ComponentDetection {
    static componentDetectionPath: string;
    static outputPath: string;
    static scanAndGetManifests(path: string): Promise<Manifest[] | undefined>;
    static downloadLatestRelease(): Promise<void>;
    static runComponentDetection(path: string): Promise<void>;
    private static getComponentDetectionParameters;
    static getManifestsFromResults(): Promise<Manifest[] | undefined>;
    static processComponentsToManifests(componentsFound: any[], dependencyGraphs: DependencyGraphs): Manifest[];
    private static addPackagesToManifests;
    private static getDependencyScope;
    static makePackageUrl(packageUrlJson: any): string;
    private static getLatestReleaseURL;
    /**
     * Normalizes the keys of a DependencyGraphs object to be relative paths from the resolved filePath input.
     * @param dependencyGraphs The DependencyGraphs object to normalize.
     * @param filePathInput The filePath input (relative or absolute) from the action configuration.
     * @returns A new DependencyGraphs object with relative path keys.
     */
    static normalizeDependencyGraphPaths(dependencyGraphs: DependencyGraphs, filePathInput: string): DependencyGraphs;
}
/**
 * Types for the dependencyGraphs section of output.json
 */
export type DependencyGraph = {
    /**
     * The dependency graph: keys are component IDs, values are either null (no dependencies) or an array of component IDs (dependencies)
     */
    graph: Record<string, string[] | null>;
    /**
     * Explicitly referenced component IDs
     */
    explicitlyReferencedComponentIds: string[];
    /**
     * Development dependencies
     */
    developmentDependencies: string[];
    /**
     * Regular dependencies
     */
    dependencies: string[];
};
/**
 * The top-level dependencyGraphs object: keys are manifest file paths, values are DependencyGraph objects
 */
export type DependencyGraphs = Record<string, DependencyGraph>;
