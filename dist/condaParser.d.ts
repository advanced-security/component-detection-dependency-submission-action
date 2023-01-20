import { Manifest } from '@github/dependency-submission-toolkit';
export default class CondaParser {
    static searchFiles(filePath?: string, filePattern?: string): string[];
    static getManifestsFromEnvironmentFiles(files: string[]): any[];
    static getManifestFromYaml(yaml: any, filePath: string): Manifest;
    static getPurlFromDependency(dependency: string, ecosystem: string): string;
}
