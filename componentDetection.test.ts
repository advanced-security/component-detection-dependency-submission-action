import ComponentDetection, { DependencyGraphs } from "./componentDetection";
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
  test("adds package as direct dependency when it is listed as an explicitlyReferencedComponentIds", () => {
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

    const dependencyGraphs: DependencyGraphs = {
      "package.json": {
        graph: { "test-package": null },
        explicitlyReferencedComponentIds: ["test-package 1.0.0 - npm"],
        developmentDependencies: [],
        dependencies: []
      }
    };

    const manifests = ComponentDetection.processComponentsToManifests(componentsFound, dependencyGraphs);

    expect(manifests).toHaveLength(1);
    expect(manifests[0].name).toBe("package.json");
    expect(manifests[0].directDependencies()).toHaveLength(1);
    expect(manifests[0].indirectDependencies()).toHaveLength(0);
    expect(manifests[0].countDependencies()).toBe(1);
  });

  test("adds package as indirect dependency when it is not in explicitlyReferencedComponentIds", () => {
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

    const dependencyGraphs: DependencyGraphs = {
      "package.json": {
        graph: { "parent-package": null },
        explicitlyReferencedComponentIds: [],
        developmentDependencies: [],
        dependencies: []
      }
    };

    const manifests = ComponentDetection.processComponentsToManifests(componentsFound, dependencyGraphs);

    expect(manifests).toHaveLength(1);
    expect(manifests[0].name).toBe("package.json");
    expect(manifests[0].directDependencies()).toHaveLength(0);
    expect(manifests[0].indirectDependencies()).toHaveLength(1);
    expect(manifests[0].countDependencies()).toBe(1);
  });
});

describe('normalizeDependencyGraphPaths', () => {
  test('converts absolute paths to relative paths based on filePath input', () => {
    // Simulate a repo at /repo and a scan root at /repo/packages
    const fakeCwd = '/workspaces';
    const filePathInput = 'my-super-cool-repo';
    const absBase = '/workspaces/my-super-cool-repo';
    const dependencyGraphs: DependencyGraphs = {
      '/workspaces/my-super-cool-repo/a/package.json': {
        graph: { 'foo': null },
        explicitlyReferencedComponentIds: [],
        developmentDependencies: [],
        dependencies: []
      },
      '/workspaces/my-super-cool-repo/b/package.json': {
        graph: { 'bar': null },
        explicitlyReferencedComponentIds: [],
        developmentDependencies: [],
        dependencies: []
      }
    };
    // Patch process.cwd for this test
    const originalCwd = process.cwd;
    (process as any).cwd = () => fakeCwd;
    const normalized = ComponentDetection.normalizeDependencyGraphPaths(dependencyGraphs, filePathInput);
    // Restore process.cwd
    (process as any).cwd = originalCwd;
    expect(Object.keys(normalized)).toContain('a/package.json');
    expect(Object.keys(normalized)).toContain('b/package.json');
    expect(normalized['a/package.json'].graph).toEqual({ 'foo': null });
    expect(normalized['b/package.json'].graph).toEqual({ 'bar': null });
  });
});

describe('normalizeDependencyGraphPaths with real output.json', () => {
  test('converts absolute paths in output.json to relative paths using current cwd and filePath', () => {
    const output = JSON.parse(fs.readFileSync('./output.json', 'utf8'));
    const dependencyGraphs = output.dependencyGraphs;
    // Use the same filePath as the action default (".")
    const normalized = ComponentDetection.normalizeDependencyGraphPaths(dependencyGraphs, 'test');

    // Should contain root level manifests without leading slashes
    expect(Object.keys(normalized)).toContain('package.json');
    expect(Object.keys(normalized)).toContain('package-lock.json');

    // Should contain nested manifests with relative paths (no leading slashes)
    expect(Object.keys(normalized)).toContain('nested/package.json');
    expect(Object.keys(normalized)).toContain('nested/package-lock.json');

    // All keys should be relative paths without leading slashes
    for (const key of Object.keys(normalized)) {
      expect(key.startsWith('/')).toBe(false); // No leading slashes
      expect(key).not.toMatch(/^\w:\\|^\/\/|^\.{1,2}\//); // Not windows absolute, not network, not relative
    }
  });
});

test('full action scan creates manifests with correct names and file source locations', async () => {
  await ComponentDetection.downloadLatestRelease();
  const manifests = await ComponentDetection.scanAndGetManifests('./test');

  expect(manifests).toBeDefined();
  expect(manifests!.length).toBeGreaterThan(0);

  for (const manifest of manifests!) {
    expect(manifest.name.startsWith('/')).toBe(false);
  }

  const expectedManifestNames = [
    'package.json',
    'package-lock.json',
    'nested/package.json',
    'nested/package-lock.json',
  ];

  const manifestsByName = manifests!.reduce((acc, manifest) => {
    acc[manifest.name] = manifest;
    return acc;
  }, {} as Record<string, any>);

  for (const expectedName of expectedManifestNames) {
    const manifest = manifestsByName[expectedName];
    expect(manifest).toBeDefined();
    expect(manifest.name).toBe(expectedName);
    expect(manifest.file?.source_location).toBe(expectedName);
  }
}, 15000);
