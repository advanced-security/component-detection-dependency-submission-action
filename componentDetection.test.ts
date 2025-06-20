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

describe("ComponentDetection.processComponentsToManifests", () => {
  test("adds package as direct dependency when no top level referrers", () => {
    const componentsFound = [
      {
        component: {
          name: "test-package",
          version: "1.0.0",
          packageUrl: {
            Scheme: "pkg",
            Type: "npm",
            Name: "test-package",
            Version: "1.0.0"
          },
          id: "test-package 1.0.0 - npm"
        },
        isDevelopmentDependency: false,
        topLevelReferrers: [], // Empty = direct dependency
        locationsFoundAt: ["package.json"]
      }
    ];

    const manifests = ComponentDetection.processComponentsToManifests(componentsFound);

    expect(manifests).toHaveLength(1);
    expect(manifests[0].name).toBe("package.json");
    expect(manifests[0].directDependencies()).toHaveLength(1);
    expect(manifests[0].indirectDependencies()).toHaveLength(0);
    expect(manifests[0].countDependencies()).toBe(1);
  });

  test("adds package as indirect dependency when has top level referrers", () => {
    const componentsFound = [
      {
        component: {
          name: "test-package",
          version: "1.0.0",
          packageUrl: {
            Scheme: "pkg",
            Type: "npm",
            Name: "test-package",
            Version: "1.0.0"
          },
          id: "test-package 1.0.0 - npm"
        },
        isDevelopmentDependency: false,
        topLevelReferrers: [
          {
            name: "parent-package",
            version: "1.0.0",
            packageUrl: {
              Scheme: "pkg",
              Type: "npm",
              Name: "parent-package",
              Version: "1.0.0"
            }
          }
        ],
        locationsFoundAt: ["package.json"]
      }
    ];

    const manifests = ComponentDetection.processComponentsToManifests(componentsFound);

    expect(manifests).toHaveLength(1);
    expect(manifests[0].name).toBe("package.json");
    expect(manifests[0].directDependencies()).toHaveLength(0);
    expect(manifests[0].indirectDependencies()).toHaveLength(1);
    expect(manifests[0].countDependencies()).toBe(1);
  });

  test("adds package as direct dependency when top level referrer is itself", () => {
    const componentsFound = [
      {
        component: {
          name: "test-package",
          version: "1.0.0",
          packageUrl: {
            Scheme: "pkg",
            Type: "npm",
            Name: "test-package",
            Version: "1.0.0"
          },
          id: "test-package 1.0.0 - npm"
        },
        isDevelopmentDependency: false,
        topLevelReferrers: [
          {
            name: "test-package",
            version: "1.0.0",
            packageUrl: {
              Scheme: "pkg",
              Type: "npm",
              Name: "test-package",
              Version: "1.0.0"
            }
          }
        ],
        locationsFoundAt: ["package.json"]
      }
    ];

    const manifests = ComponentDetection.processComponentsToManifests(componentsFound);

    expect(manifests).toHaveLength(1);
    expect(manifests[0].name).toBe("package.json");
    expect(manifests[0].directDependencies()).toHaveLength(1);
    expect(manifests[0].indirectDependencies()).toHaveLength(0);
    expect(manifests[0].countDependencies()).toBe(1);
  });
});
