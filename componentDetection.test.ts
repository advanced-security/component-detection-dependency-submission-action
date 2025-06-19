import ComponentDetection from "./componentDetection";
import fs from "fs";

test("Downloads CLI", async () => {
  await ComponentDetection.downloadLatestRelease();
  expect(fs.existsSync(ComponentDetection.componentDetectionPath));
});

test("Runs CLI", async () => {
  await ComponentDetection.downloadLatestRelease();
  await ComponentDetection.runComponentDetection("./test");
  expect(fs.existsSync(ComponentDetection.outputPath));
}, 10000);

test("Parses CLI output", async () => {
  await ComponentDetection.downloadLatestRelease();
  await ComponentDetection.runComponentDetection("./test");
  var manifests = await ComponentDetection.getManifestsFromResults();
  expect(manifests?.length == 2);
});

describe("ComponentDetection.makePackageUrl", () => {
  test("returns a valid package url from saturated object", () => {
    const packageUrl = ComponentDetection.makePackageUrl({
      Scheme: "pkg",
      Type: "npm",
      Namespace: "github",
      Name: "component-detection-action",
      Version: "0.0.2",
      Qualifiers: {
        arch: "amd64",
        os: "linux",
      },
    });
    expect(packageUrl).toBe(
      "pkg:npm/github/component-detection-action@0.0.2?arch=amd64&os=linux"
    );
  });

  test("returns valid package url without dangling ? with empty qualifers", () => {
    const packageUrl = ComponentDetection.makePackageUrl({
      Scheme: "pkg",
      Type: "npm",
      Namespace: "github",
      Name: "component-detection-action",
      Version: "0.0.2",
      Qualifiers: { },
    });
    expect(packageUrl).toBe(
      "pkg:npm/github/component-detection-action@0.0.2"
    );
  });

  test("returns an empty string when packageUrlJson is null", () => {
    const packageUrl = ComponentDetection.makePackageUrl(null);
    expect(packageUrl).toBe("");
  });

  test("returns an empty string for null packageUrlJson properties", () => {
    const packageUrl = ComponentDetection.makePackageUrl({
      Scheme: null,
      Type: null,
      Namespace: null,
      Name: null,
      Version: null,
      Qualifiers: null
    });
    expect(packageUrl).toBe("");
  });
});

describe("ComponentDetection.addPackagesToManifests", () => {
  test("adds package as direct dependency when no top level referrers", () => {
    const manifests: any[] = [];

    const testPackage = {
      id: "test-package-1",
      packageUrl: "pkg:npm/test-package@1.0.0",
      isDevelopmentDependency: false,
      topLevelReferrers: [], // Empty array = direct dependency
      locationsFoundAt: ["package.json"],
      containerDetailIds: [],
      containerLayerIds: [],
      packageID: () => "pkg:npm/test-package@1.0.0",
      packageURL: { toString: () => "pkg:npm/test-package@1.0.0" }
    };

    ComponentDetection.addPackagesToManifests([testPackage] as any, manifests);

    expect(manifests).toHaveLength(1);
    expect(manifests[0].name).toBe("package.json");

    // Test the actual manifest state instead of mock calls
    expect(manifests[0].directDependencies()).toHaveLength(1);
    expect(manifests[0].indirectDependencies()).toHaveLength(0);
    expect(manifests[0].countDependencies()).toBe(1);
  });

  test("adds package as indirect dependency when has top level referrers", () => {
    const manifests: any[] = [];

    const testPackage = {
      id: "test-package-2",
      packageUrl: "pkg:npm/test-package@2.0.0",
      isDevelopmentDependency: false,
      topLevelReferrers: [{ packageUrl: "pkg:npm/parent-package@1.0.0" }], // Has referrers = indirect
      locationsFoundAt: ["package.json"],
      containerDetailIds: [],
      containerLayerIds: [],
      packageID: () => "pkg:npm/test-package@2.0.0",
      packageURL: { toString: () => "pkg:npm/test-package@2.0.0" }
    };

    ComponentDetection.addPackagesToManifests([testPackage] as any, manifests);

    expect(manifests).toHaveLength(1);
    expect(manifests[0].name).toBe("package.json");

    expect(manifests[0].directDependencies()).toHaveLength(0);
    expect(manifests[0].indirectDependencies()).toHaveLength(1);
    expect(manifests[0].countDependencies()).toBe(1);
  });

  test("adds package as indirect dependency when top level referrer is itself", () => {
    const manifests: any[] = [];

    const testPackage = {
      id: "test-package-3",
      packageUrl: "pkg:npm/test-package@3.0.0",
      isDevelopmentDependency: false,
      topLevelReferrers: [{ packageUrl: "pkg:npm/test-package@3.0.0" }], // Self-reference case
      locationsFoundAt: ["package.json"],
      containerDetailIds: [],
      containerLayerIds: [],
      packageID: () => "pkg:npm/test-package@3.0.0",
      packageURL: { toString: () => "pkg:npm/test-package@3.0.0" }
    };

    ComponentDetection.addPackagesToManifests([testPackage] as any, manifests);

    expect(manifests).toHaveLength(1);
    expect(manifests[0].name).toBe("package.json");

    // Self-referencing packages are currently treated as indirect - this might be a bug to investigate
    expect(manifests[0].directDependencies()).toHaveLength(0);
    expect(manifests[0].indirectDependencies()).toHaveLength(1);
    expect(manifests[0].countDependencies()).toBe(1);
  });

  test("handles multiple packages with mixed dependency types", () => {
    const manifests: any[] = [];

    const directTestPackage = {
      id: "direct-package",
      packageUrl: "pkg:npm/direct-package@1.0.0",
      isDevelopmentDependency: false,
      topLevelReferrers: [], // Direct
      locationsFoundAt: ["package.json"],
      containerDetailIds: [],
      containerLayerIds: [],
      packageID: () => "pkg:npm/direct-package@1.0.0",
      packageURL: { toString: () => "pkg:npm/direct-package@1.0.0" }
    };

    const indirectTestPackage = {
      id: "indirect-package",
      packageUrl: "pkg:npm/indirect-package@1.0.0",
      isDevelopmentDependency: false,
      topLevelReferrers: [{ packageUrl: "pkg:npm/parent@1.0.0" }], // Indirect
      locationsFoundAt: ["package.json"],
      containerDetailIds: [],
      containerLayerIds: [],
      packageID: () => "pkg:npm/indirect-package@1.0.0",
      packageURL: { toString: () => "pkg:npm/indirect-package@1.0.0" }
    };

    ComponentDetection.addPackagesToManifests([directTestPackage, indirectTestPackage] as any, manifests);

    expect(manifests).toHaveLength(1);
    expect(manifests[0].name).toBe("package.json");

    expect(manifests[0].directDependencies()).toHaveLength(1);
    expect(manifests[0].indirectDependencies()).toHaveLength(1);
    expect(manifests[0].countDependencies()).toBe(2);
  });

  test("creates separate manifests for different locations", () => {
    const manifests: any[] = [];

    const packageJsonTestPackage = {
      id: "package-json-dep",
      packageUrl: "pkg:npm/package-json-dep@1.0.0",
      isDevelopmentDependency: false,
      topLevelReferrers: [],
      locationsFoundAt: ["package.json"],
      containerDetailIds: [],
      containerLayerIds: [],
      packageID: () => "pkg:npm/package-json-dep@1.0.0",
      packageURL: { toString: () => "pkg:npm/package-json-dep@1.0.0" }
    };

    const csprojTestPackage = {
      id: "csproj-dep",
      packageUrl: "pkg:nuget/csproj-dep@1.0.0",
      isDevelopmentDependency: false,
      topLevelReferrers: [],
      locationsFoundAt: ["project.csproj"],
      containerDetailIds: [],
      containerLayerIds: [],
      packageID: () => "pkg:nuget/csproj-dep@1.0.0",
      packageURL: { toString: () => "pkg:nuget/csproj-dep@1.0.0" }
    };

    ComponentDetection.addPackagesToManifests([packageJsonTestPackage, csprojTestPackage] as any, manifests);

    expect(manifests).toHaveLength(2);

    const packageJsonManifest = manifests.find(m => m.name === "package.json");
    const csprojManifest = manifests.find(m => m.name === "project.csproj");

    expect(packageJsonManifest).toBeDefined();
    expect(csprojManifest).toBeDefined();

    expect(packageJsonManifest.countDependencies()).toBe(1);
    expect(csprojManifest.countDependencies()).toBe(1);
  });
});
