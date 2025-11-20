"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const github = __importStar(require("@actions/github"));
const core = __importStar(require("@actions/core"));
const octokit_1 = require("octokit");
const dependency_submission_toolkit_1 = require("@github/dependency-submission-toolkit");
const cross_fetch_1 = __importDefault(require("cross-fetch"));
const fs_1 = __importDefault(require("fs"));
const exec = __importStar(require("@actions/exec"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
class ComponentDetection {
    // This is the default entry point for this class.
    static scanAndGetManifests(path) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.downloadLatestRelease();
            yield this.runComponentDetection(path);
            return yield this.getManifestsFromResults();
        });
    }
    // Get the latest release from the component-detection repo, download the tarball, and extract it
    static downloadLatestRelease() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                core.debug(`Downloading latest release for ${process.platform}`);
                const downloadURL = yield this.getLatestReleaseURL();
                const blob = yield (yield (0, cross_fetch_1.default)(new URL(downloadURL))).blob();
                const arrayBuffer = yield blob.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                // Write the blob to a file
                core.debug(`Writing binary to file ${this.componentDetectionPath}`);
                yield fs_1.default.writeFileSync(this.componentDetectionPath, buffer, { mode: 0o777, flag: 'w' });
            }
            catch (error) {
                core.error(error);
            }
        });
    }
    // Run the component-detection CLI on the path specified
    static runComponentDetection(path) {
        return __awaiter(this, void 0, void 0, function* () {
            core.info("Running component-detection");
            try {
                yield exec.exec(`${this.componentDetectionPath} scan --SourceDirectory ${path} --ManifestFile ${this.outputPath} ${this.getComponentDetectionParameters()}`);
            }
            catch (error) {
                core.error(error);
            }
        });
    }
    static getComponentDetectionParameters() {
        var parameters = "";
        parameters += (core.getInput('directoryExclusionList')) ? ` --DirectoryExclusionList ${core.getInput('directoryExclusionList')}` : "";
        parameters += (core.getInput('detectorArgs')) ? ` --DetectorArgs ${core.getInput('detectorArgs')}` : "";
        parameters += (core.getInput('detectorsFilter')) ? ` --DetectorsFilter ${core.getInput('detectorsFilter')}` : "";
        parameters += (core.getInput('detectorsCategories')) ? ` --DetectorCategories ${core.getInput('detectorsCategories')}` : "";
        parameters += (core.getInput('dockerImagesToScan')) ? ` --DockerImagesToScan ${core.getInput('dockerImagesToScan')}` : "";
        return parameters;
    }
    static getManifestsFromResults() {
        return __awaiter(this, void 0, void 0, function* () {
            core.info("Getting manifests from results");
            const results = yield fs_1.default.readFileSync(this.outputPath, 'utf8');
            var json = JSON.parse(results);
            let dependencyGraphs = this.normalizeDependencyGraphPaths(json.dependencyGraphs, core.getInput('filePath'));
            return this.processComponentsToManifests(json.componentsFound, dependencyGraphs);
        });
    }
    static processComponentsToManifests(componentsFound, dependencyGraphs) {
        // Parse the result file and add the packages to the package cache
        const packageCache = new dependency_submission_toolkit_1.PackageCache();
        const packages = [];
        componentsFound.forEach((component) => __awaiter(this, void 0, void 0, function* () {
            // Skip components without packageUrl
            if (!component.component.packageUrl) {
                core.debug(`Skipping component detected without packageUrl: ${JSON.stringify({
                    id: component.component.id,
                    name: component.component.name || 'unnamed',
                    type: component.component.type || 'unknown'
                }, null, 2)}`);
                return;
            }
            const packageUrl = ComponentDetection.makePackageUrl(component.component.packageUrl);
            // Skip if the packageUrl is empty (indicates an invalid or missing packageUrl)
            if (!packageUrl) {
                core.debug(`Skipping component with invalid packageUrl: ${component.component.id}`);
                return;
            }
            if (!packageCache.hasPackage(packageUrl)) {
                const pkg = new ComponentDetectionPackage(packageUrl, component.component.id, component.isDevelopmentDependency, component.topLevelReferrers, component.locationsFoundAt, component.containerDetailIds, component.containerLayerIds);
                packageCache.addPackage(pkg);
                packages.push(pkg);
            }
        }));
        // Set the transitive dependencies
        core.debug("Sorting out transitive dependencies");
        packages.forEach((pkg) => __awaiter(this, void 0, void 0, function* () {
            pkg.topLevelReferrers.forEach((referrer) => __awaiter(this, void 0, void 0, function* () {
                // Skip if referrer doesn't have a valid packageUrl
                if (!referrer.packageUrl) {
                    core.debug(`Skipping referrer without packageUrl for component: ${pkg.id}`);
                    return;
                }
                const referrerUrl = ComponentDetection.makePackageUrl(referrer.packageUrl);
                referrer.packageUrlString = referrerUrl;
                // Skip if the generated packageUrl is empty
                if (!referrerUrl) {
                    core.debug(`Skipping referrer with invalid packageUrl for component: ${pkg.id}`);
                    return;
                }
                try {
                    const referrerPackage = packageCache.lookupPackage(referrerUrl);
                    if (referrerPackage === pkg) {
                        core.debug(`Skipping self-reference for package: ${pkg.id}`);
                        return; // Skip self-references
                    }
                    if (referrerPackage) {
                        referrerPackage.dependsOn(pkg);
                    }
                }
                catch (error) {
                    core.debug(`Error looking up referrer package: ${error}`);
                }
            }));
        }));
        // Create manifests
        const manifests = [];
        // Check the locationsFoundAt for every package and add each as a manifest
        this.addPackagesToManifests(packages, manifests, dependencyGraphs);
        return manifests;
    }
    static addPackagesToManifests(packages, manifests, dependencyGraphs) {
        packages.forEach((pkg) => {
            pkg.locationsFoundAt.forEach((location) => {
                var _a, _b;
                // Use the normalized path (remove leading slash if present)
                const normalizedLocation = location.startsWith('/') ? location.substring(1) : location;
                if (!manifests.find((manifest) => manifest.name == normalizedLocation)) {
                    const manifest = new dependency_submission_toolkit_1.Manifest(normalizedLocation, normalizedLocation);
                    manifests.push(manifest);
                }
                const depGraphEntry = dependencyGraphs[normalizedLocation];
                if (!depGraphEntry) {
                    core.warning(`No dependency graph entry found for manifest location: ${normalizedLocation}`);
                    return; // Skip this location if not found in dependencyGraphs
                }
                const directDependencies = depGraphEntry.explicitlyReferencedComponentIds;
                if (directDependencies.includes(pkg.id)) {
                    (_a = manifests
                        .find((manifest) => manifest.name == normalizedLocation)) === null || _a === void 0 ? void 0 : _a.addDirectDependency(pkg, ComponentDetection.getDependencyScope(pkg));
                }
                else {
                    (_b = manifests
                        .find((manifest) => manifest.name == normalizedLocation)) === null || _b === void 0 ? void 0 : _b.addIndirectDependency(pkg, ComponentDetection.getDependencyScope(pkg));
                }
            });
        });
    }
    static getDependencyScope(pkg) {
        return pkg.isDevelopmentDependency ? 'development' : 'runtime';
    }
    static makePackageUrl(packageUrlJson) {
        // Handle case when packageUrlJson is null or undefined
        if (!packageUrlJson ||
            typeof packageUrlJson.Scheme !== 'string' ||
            typeof packageUrlJson.Type !== 'string' ||
            !packageUrlJson.Scheme ||
            !packageUrlJson.Type) {
            core.debug(`Warning: Received null or undefined packageUrlJson. Unable to create package URL.`);
            return ""; // Return a blank string for unknown packages
        }
        try {
            var packageUrl = `${packageUrlJson.Scheme}:${packageUrlJson.Type}/`;
            if (packageUrlJson.Namespace) {
                packageUrl += `${packageUrlJson.Namespace.replaceAll("@", "%40")}/`;
            }
            packageUrl += `${packageUrlJson.Name.replaceAll("@", "%40")}`;
            if (packageUrlJson.Version) {
                packageUrl += `@${packageUrlJson.Version}`;
            }
            if (typeof packageUrlJson.Qualifiers === "object"
                && packageUrlJson.Qualifiers !== null
                && Object.keys(packageUrlJson.Qualifiers).length > 0) {
                const qualifierString = Object.entries(packageUrlJson.Qualifiers)
                    .map(([key, value]) => `${key}=${value}`)
                    .join("&");
                packageUrl += `?${qualifierString}`;
            }
            return packageUrl;
        }
        catch (error) {
            core.debug(`Error creating package URL from packageUrlJson: ${JSON.stringify(packageUrlJson, null, 2)}`);
            core.debug(`Error details: ${error}`);
            return ""; // Return a blank string for error cases
        }
    }
    static getLatestReleaseURL() {
        return __awaiter(this, void 0, void 0, function* () {
            let githubToken = core.getInput('token') || process.env.GITHUB_TOKEN || "";
            const githubAPIURL = 'https://api.github.com';
            let ghesMode = github.context.apiUrl != githubAPIURL;
            // If the we're running in GHES, then use an empty string as the token
            if (ghesMode) {
                githubToken = "";
            }
            const octokit = new octokit_1.Octokit({ auth: githubToken, baseUrl: githubAPIURL, request: { fetch: cross_fetch_1.default }, log: {
                    debug: core.debug,
                    info: core.info,
                    warn: core.warning,
                    error: core.error
                }, });
            const owner = "microsoft";
            const repo = "component-detection";
            core.debug("Attempting to download latest release from " + githubAPIURL);
            try {
                const latestRelease = yield octokit.request("GET /repos/{owner}/{repo}/releases/latest", { owner, repo });
                var downloadURL = "";
                const assetName = process.platform === "win32" ? "component-detection-win-x64.exe" : "component-detection-linux-x64";
                latestRelease.data.assets.forEach((asset) => {
                    if (asset.name === assetName) {
                        downloadURL = asset.browser_download_url;
                    }
                });
                return downloadURL;
            }
            catch (error) {
                core.error(error);
                core.debug(error.message);
                core.debug(error.stack);
                throw new Error("Failed to download latest release");
            }
        });
    }
    /**
     * Normalizes the keys of a DependencyGraphs object to be relative paths from the resolved filePath input.
     * @param dependencyGraphs The DependencyGraphs object to normalize.
     * @param filePathInput The filePath input (relative or absolute) from the action configuration.
     * @returns A new DependencyGraphs object with relative path keys.
     */
    static normalizeDependencyGraphPaths(dependencyGraphs, filePathInput) {
        // Resolve the base directory from filePathInput (relative to cwd if not absolute)
        const baseDir = path_1.default.resolve(process.cwd(), filePathInput);
        const normalized = {};
        for (const absPath in dependencyGraphs) {
            // Make the path relative to the baseDir
            let relPath = path_1.default.relative(baseDir, absPath).replace(/\\/g, '/');
            normalized[relPath] = dependencyGraphs[absPath];
        }
        return normalized;
    }
}
ComponentDetection.componentDetectionPath = process.platform === "win32" ? './component-detection.exe' : './component-detection';
ComponentDetection.outputPath = './output.json';
exports.default = ComponentDetection;
class ComponentDetectionPackage extends dependency_submission_toolkit_1.Package {
    constructor(packageUrl, id, isDevelopmentDependency, topLevelReferrers, locationsFoundAt, containerDetailIds, containerLayerIds) {
        super(packageUrl);
        this.id = id;
        this.isDevelopmentDependency = isDevelopmentDependency;
        this.topLevelReferrers = topLevelReferrers;
        this.locationsFoundAt = locationsFoundAt;
        this.containerDetailIds = containerDetailIds;
        this.containerLayerIds = containerLayerIds;
        this.packageUrlString = packageUrl;
    }
}
//# sourceMappingURL=componentDetection.js.map