import ComponentDetection, { type DependencyGraph, type DependencyGraphs } from "./componentDetection";
import fs from "fs";

test("Downloads CLI", async () => {
  await ComponentDetection.downloadLatestRelease();
  expect(fs.existsSync(ComponentDetection.componentDetectionPath));
});

test("Runs CLI", async () => {
  await ComponentDetection.downloadLatestRelease();
  await ComponentDetection.runComponentDetection("./test");
  expect(fs.existsSync(ComponentDetection.outputPath));
});

test("Parses CLI output", async () => {
  await ComponentDetection.downloadLatestRelease();
  await ComponentDetection.runComponentDetection("./test");
  var manifests = await ComponentDetection.getManifestsFromResults();
  expect(manifests?.map(manifest => manifest.name).sort()).toEqual([
    "test/go/go.mod",
    "test/nested/package-lock.json",
    "test/nested/package.json",
    "test/nuget/packages.config",
    "test/package-lock.json",
    "test/package.json",
    "test/ruby/Gemfile.lock"
  ]);
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
        graph: { "test-package 1.0.0 - npm": null },
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
        graph: { "test-package 1.0.0 - npm": null },
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

  test("creates manifests from dependency graph paths instead of installed package locations", () => {
    const componentsFound = [
      {
        component: {
          name: "express",
          version: "4.18.2",
          packageUrl: {
            Scheme: "pkg",
            Type: "npm",
            Name: "express",
            Version: "4.18.2"
          },
          id: "express 4.18.2 - npm"
        },
        isDevelopmentDependency: false,
        topLevelReferrers: [],
        locationsFoundAt: ["node_modules/express/package.json"]
      },
      {
        component: {
          name: "body-parser",
          version: "1.20.1",
          packageUrl: {
            Scheme: "pkg",
            Type: "npm",
            Name: "body-parser",
            Version: "1.20.1"
          },
          id: "body-parser 1.20.1 - npm"
        },
        isDevelopmentDependency: false,
        topLevelReferrers: [],
        locationsFoundAt: ["node_modules/body-parser/package.json"]
      },
      {
        component: {
          name: "@scope/frontend",
          version: "2.0.0",
          packageUrl: {
            Scheme: "pkg",
            Type: "npm",
            Namespace: "@scope",
            Name: "frontend",
            Version: "2.0.0"
          },
          id: "@scope/frontend 2.0.0 - npm"
        },
        isDevelopmentDependency: false,
        topLevelReferrers: [],
        locationsFoundAt: ["frontend/node_modules/@scope/frontend/package.json"]
      },
      {
        component: {
          name: "loose-envify",
          version: "1.4.0",
          packageUrl: {
            Scheme: "pkg",
            Type: "npm",
            Name: "loose-envify",
            Version: "1.4.0"
          },
          id: "loose-envify 1.4.0 - npm"
        },
        isDevelopmentDependency: false,
        topLevelReferrers: [],
        locationsFoundAt: ["frontend/node_modules/loose-envify/package.json"]
      }
    ];

    const rootGraph: DependencyGraph = {
      graph: {
        "express 4.18.2 - npm": ["body-parser 1.20.1 - npm"],
        "body-parser 1.20.1 - npm": null
      },
      explicitlyReferencedComponentIds: ["express 4.18.2 - npm"],
      developmentDependencies: [],
      dependencies: ["express 4.18.2 - npm", "body-parser 1.20.1 - npm"]
    };
    const frontendGraph: DependencyGraph = {
      graph: {
        "@scope/frontend 2.0.0 - npm": ["loose-envify 1.4.0 - npm"],
        "loose-envify 1.4.0 - npm": null
      },
      explicitlyReferencedComponentIds: ["@scope/frontend 2.0.0 - npm"],
      developmentDependencies: [],
      dependencies: ["@scope/frontend 2.0.0 - npm", "loose-envify 1.4.0 - npm"]
    };
    const dependencyGraphs: DependencyGraphs = {
      "package.json": rootGraph,
      "package-lock.json": rootGraph,
      "frontend/package.json": frontendGraph,
      "frontend/package-lock.json": frontendGraph,
      "node_modules/express/package.json": {
        graph: { "express 4.18.2 - npm": null },
        explicitlyReferencedComponentIds: [],
        developmentDependencies: [],
        dependencies: []
      },
      "frontend/node_modules/@scope/frontend/package.json": {
        graph: { "@scope/frontend 2.0.0 - npm": null },
        explicitlyReferencedComponentIds: [],
        developmentDependencies: [],
        dependencies: []
      }
    };

    const manifests = ComponentDetection.processComponentsToManifests(componentsFound, dependencyGraphs);

    expect(manifests.map(manifest => manifest.name)).toEqual([
      "package.json",
      "package-lock.json",
      "frontend/package.json",
      "frontend/package-lock.json"
    ]);
    expect(manifests.some(manifest => manifest.name.includes("node_modules"))).toBe(false);

    const rootManifest = manifests.find(manifest => manifest.name === "package-lock.json")!;
    const express = rootManifest.directDependencies()[0];
    const bodyParser = rootManifest.indirectDependencies()[0];
    expect(express.packageID()).toBe("pkg:npm/express@4.18.2");
    expect(express.dependencies.map(dependency => dependency.packageID())).toEqual([
      "pkg:npm/body-parser@1.20.1"
    ]);
    expect(rootManifest.lookupDependency(express)?.scope).toBe("runtime");
    expect(bodyParser.packageID()).toBe("pkg:npm/body-parser@1.20.1");
    expect(rootManifest.lookupDependency(bodyParser)?.scope).toBe("runtime");

    const frontendManifest = manifests.find(manifest => manifest.name === "frontend/package-lock.json")!;
    const frontend = frontendManifest.directDependencies()[0];
    expect(frontend.packageID()).toBe("pkg:npm/%40scope/frontend@2.0.0");
    expect(frontend.dependencies.map(dependency => dependency.packageID())).toEqual([
      "pkg:npm/loose-envify@1.4.0"
    ]);
  });

  test("keeps dependency edges and scopes isolated to each source manifest", () => {
    const componentsFound = [
      {
        component: {
          packageUrl: {
            Scheme: "pkg",
            Type: "npm",
            Name: "shared-parent",
            Version: "1.0.0"
          },
          id: "shared-parent 1.0.0 - npm"
        },
        isDevelopmentDependency: false,
        topLevelReferrers: [],
        locationsFoundAt: ["node_modules/shared-parent/package.json"]
      },
      {
        component: {
          packageUrl: {
            Scheme: "pkg",
            Type: "npm",
            Name: "root-child",
            Version: "1.0.0"
          },
          id: "root-child 1.0.0 - npm"
        },
        isDevelopmentDependency: false,
        topLevelReferrers: [],
        locationsFoundAt: ["node_modules/root-child/package.json"]
      },
      {
        component: {
          packageUrl: {
            Scheme: "pkg",
            Type: "npm",
            Name: "nested-child",
            Version: "1.0.0"
          },
          id: "nested-child 1.0.0 - npm"
        },
        isDevelopmentDependency: false,
        topLevelReferrers: [],
        locationsFoundAt: ["nested/node_modules/nested-child/package.json"]
      }
    ];
    const dependencyGraphs: DependencyGraphs = {
      "package-lock.json": {
        graph: {
          "shared-parent 1.0.0 - npm": ["root-child 1.0.0 - npm"],
          "root-child 1.0.0 - npm": null
        },
        explicitlyReferencedComponentIds: ["shared-parent 1.0.0 - npm"],
        developmentDependencies: [],
        dependencies: ["shared-parent 1.0.0 - npm", "root-child 1.0.0 - npm"]
      },
      "nested/package-lock.json": {
        graph: {
          "shared-parent 1.0.0 - npm": ["nested-child 1.0.0 - npm"],
          "nested-child 1.0.0 - npm": null
        },
        explicitlyReferencedComponentIds: ["shared-parent 1.0.0 - npm"],
        developmentDependencies: ["shared-parent 1.0.0 - npm", "nested-child 1.0.0 - npm"],
        dependencies: []
      }
    };

    const manifests = ComponentDetection.processComponentsToManifests(componentsFound, dependencyGraphs);
    const rootManifest = manifests.find(manifest => manifest.name === "package-lock.json")!;
    const nestedManifest = manifests.find(manifest => manifest.name === "nested/package-lock.json")!;
    const rootParent = rootManifest.directDependencies()[0];
    const nestedParent = nestedManifest.directDependencies()[0];

    expect(rootParent.dependencies.map(dependency => dependency.packageID())).toEqual([
      "pkg:npm/root-child@1.0.0"
    ]);
    expect(nestedParent.dependencies.map(dependency => dependency.packageID())).toEqual([
      "pkg:npm/nested-child@1.0.0"
    ]);
    expect(rootManifest.lookupDependency(rootParent)?.scope).toBe("runtime");
    expect(nestedManifest.lookupDependency(nestedParent)?.scope).toBe("development");
  });

  test("uses the dependency graph path when the component location differs", () => {
    const componentsFound = [
      {
        component: {
          name: "test-package",
          version: "1.0.0",
          packageUrl: {
            Scheme: "pkg",
            Type: "nuget",
            Name: "test-package",
            Version: "1.0.0"
          },
          id: "test-package 1.0.0 - nuget"
        },
        isDevelopmentDependency: false,
        topLevelReferrers: [], // Empty = direct dependency
        locationsFoundAt: ["/unrelated/location"]
      }
    ];

    const dependencyGraphs: DependencyGraphs = {
      "my project/my project.csproj": {
        graph: { "test-package 1.0.0 - nuget": null },
        explicitlyReferencedComponentIds: ["test-package 1.0.0 - nuget"],
        developmentDependencies: [],
        dependencies: []
      }
    };

    const manifests = ComponentDetection.processComponentsToManifests(componentsFound, dependencyGraphs);

    expect(manifests).toHaveLength(1);
    expect(manifests[0].name).toBe("my project/my project.csproj");
    expect(manifests[0].directDependencies()).toHaveLength(1);
    expect(manifests[0].indirectDependencies()).toHaveLength(0);
    expect(manifests[0].countDependencies()).toBe(1);
  });
});

describe('normalizeDependencyGraphPaths', () => {
  test('converts absolute paths to paths relative to the repository root', () => {
    const repositoryRoot = '/workspaces/my-super-cool-repo';
    const dependencyGraphs: DependencyGraphs = {
      '/workspaces/my-super-cool-repo/services/api/package.json': {
        graph: { 'foo': null },
        explicitlyReferencedComponentIds: [],
        developmentDependencies: [],
        dependencies: []
      },
      '/workspaces/my-super-cool-repo/services/api/package-lock.json': {
        graph: { 'bar': null },
        explicitlyReferencedComponentIds: [],
        developmentDependencies: [],
        dependencies: []
      }
    };
    const normalized = ComponentDetection.normalizeDependencyGraphPaths(dependencyGraphs, repositoryRoot);

    expect(Object.keys(normalized)).toContain('services/api/package.json');
    expect(Object.keys(normalized)).toContain('services/api/package-lock.json');
    expect(normalized['services/api/package.json'].graph).toEqual({ 'foo': null });
    expect(normalized['services/api/package-lock.json'].graph).toEqual({ 'bar': null });
  });
});

describe('normalizeDependencyGraphPaths with real output.json', () => {
  test('converts absolute paths in output.json to repository-relative paths', () => {
    const output = JSON.parse(fs.readFileSync('./output.json', 'utf8'));
    const dependencyGraphs = output.dependencyGraphs;
    const normalized = ComponentDetection.normalizeDependencyGraphPaths(dependencyGraphs, process.cwd());

    expect(Object.keys(normalized)).toContain('test/package.json');
    expect(Object.keys(normalized)).toContain('test/package-lock.json');

    expect(Object.keys(normalized)).toContain('test/nested/package.json');
    expect(Object.keys(normalized)).toContain('test/nested/package-lock.json');

    // All keys should be relative paths without leading slashes
    for (const key of Object.keys(normalized)) {
      expect(key.startsWith('/')).toBe(false); // No leading slashes
      expect(key).not.toMatch(/^\w:\\|^\/\/|^\.{1,2}\//); // Not windows absolute, not network, not relative
    }
  });
});

test('full action scan creates manifests with correct names and file source locations', async () => {
  const generatedFixtureDirectory = './test/generated-integration-fixture';
  const installedPackageDirectory = `${generatedFixtureDirectory}/node_modules/installed-only`;
  fs.mkdirSync(installedPackageDirectory, { recursive: true });
  fs.writeFileSync(
    `${installedPackageDirectory}/package.json`,
    JSON.stringify({ name: 'installed-only', version: '1.0.0' })
  );

  let manifests;
  try {
    await ComponentDetection.downloadLatestRelease();
    manifests = await ComponentDetection.scanAndGetManifests('./test');
  } finally {
    fs.rmSync(generatedFixtureDirectory, { recursive: true, force: true });
  }

  expect(manifests).toBeDefined();
  expect(manifests!.length).toBeGreaterThan(0);
  expect(manifests!.some(manifest => manifest.name.split('/').includes('node_modules'))).toBe(false);

  for (const manifest of manifests!) {
    expect(manifest.name.startsWith('/')).toBe(false);
  }

  const expectedManifestNames = [
    'test/package.json',
    'test/package-lock.json',
    'test/nested/package.json',
    'test/nested/package-lock.json',
    'test/nuget/packages.config',
    'test/go/go.mod',
    'test/ruby/Gemfile.lock',
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

  const expectedDependencies = [
    {
      manifest: 'test/nuget/packages.config',
      packageUrl: 'pkg:nuget/Newtonsoft.Json@13.0.4',
      relationship: 'direct'
    },
    {
      manifest: 'test/go/go.mod',
      packageUrl: 'pkg:golang/github.com/google/uuid@v1.6.0',
      // The stable Go detector currently leaves explicitlyReferencedComponentIds empty.
      relationship: 'indirect'
    },
    {
      manifest: 'test/ruby/Gemfile.lock',
      packageUrl: 'pkg:gem/rake@13.2.1',
      relationship: 'direct'
    }
  ];

  for (const expected of expectedDependencies) {
    const manifest = manifestsByName[expected.manifest];
    const dependencies = expected.relationship === 'direct'
      ? manifest.directDependencies()
      : manifest.indirectDependencies();
    const dependency = dependencies
      .find((pkg: any) => pkg.packageID() === expected.packageUrl);

    expect(dependency).toBeDefined();
  }

  expect(manifestsByName['test/nuget/packages.config'].countDependencies()).toBe(1);
  expect(manifestsByName['test/go/go.mod'].countDependencies()).toBe(1);
  expect(manifestsByName['test/ruby/Gemfile.lock'].countDependencies()).toBe(2);
});
