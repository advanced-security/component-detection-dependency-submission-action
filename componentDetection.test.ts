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

    const mockPackage = {
      id: "test-package-1",
      packageUrl: "pkg:npm/test-package@1.0.0",
      isDevelopmentDependency: false,
      topLevelReferrers: [],
      locationsFoundAt: ["package.json"],
      containerDetailIds: [],
      containerLayerIds: [],
      packageID: () => "pkg:npm/test-package@1.0.0",
      packageURL: { toString: () => "pkg:npm/test-package@1.0.0" }
    };

    ComponentDetection.addPackagesToManifests([mockPackage] as any, manifests);

    expect(manifests).toHaveLength(1);
    expect(manifests[0].name).toBe("package.json");
  });

  test("adds package as indirect dependency when has top level referrers", () => {
    const manifests: any[] = [];

    const mockPackage = {
      id: "test-package-2",
      packageUrl: "pkg:npm/test-package@2.0.0",
      isDevelopmentDependency: false,
      topLevelReferrers: [{ packageUrl: "pkg:npm/parent-package@1.0.0" }],
      locationsFoundAt: ["package.json"],
      containerDetailIds: [],
      containerLayerIds: [],
      packageID: () => "pkg:npm/test-package@2.0.0",
      packageURL: { toString: () => "pkg:npm/test-package@2.0.0" }
    };

    ComponentDetection.addPackagesToManifests([mockPackage] as any, manifests);

    expect(manifests).toHaveLength(1);
    expect(manifests[0].name).toBe("package.json");
  });

  test("reuses existing manifest when same location found", () => {
    let directDependencyCallCount = 0;
    let indirectDependencyCallCount = 0;

    const existingManifest = {
      name: "package.json",
      addDirectDependency: () => { directDependencyCallCount++; },
      addIndirectDependency: () => { indirectDependencyCallCount++; }
    };
    const manifests: any[] = [existingManifest];

    const mockPackage = {
      id: "test-package-3",
      packageUrl: "pkg:npm/test-package@3.0.0",
      isDevelopmentDependency: false,
      topLevelReferrers: [],
      locationsFoundAt: ["package.json"],
      containerDetailIds: [],
      containerLayerIds: [],
      packageID: () => "pkg:npm/test-package@3.0.0",
      packageURL: { toString: () => "pkg:npm/test-package@3.0.0" }
    };

    ComponentDetection.addPackagesToManifests([mockPackage] as any, manifests);

    expect(manifests).toHaveLength(1);
    expect(manifests[0]).toBe(existingManifest);
    expect(directDependencyCallCount).toBe(1);
    expect(indirectDependencyCallCount).toBe(0);
  });
});
