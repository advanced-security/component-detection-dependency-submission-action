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
  // Mock the CLI output file
  const mockOutput = JSON.stringify({
    componentsFound: [
      {
        component: {
          packageUrl: {
            Scheme: "pkg",
            Type: "npm",
            Namespace: "github",
            Name: "component-detection-action",
            Version: "0.0.2",
            Qualifiers: { arch: "amd64", os: "linux" }
          },
          id: "1"
        },
        isDevelopmentDependency: false,
        topLevelReferrers: [],
        locationsFoundAt: ["/test/package.json"],
        containerDetailIds: [],
        containerLayerIds: []
      },
      {
        component: {
          packageUrl: {
            Scheme: "pkg",
            Type: "npm",
            Namespace: "github",
            Name: "component-detection-action",
            Version: "0.0.3",
            Qualifiers: { arch: "amd64", os: "linux" }
          },
          id: "2"
        },
        isDevelopmentDependency: true,
        topLevelReferrers: [],
        locationsFoundAt: ["/test/package-lock.json"],
        containerDetailIds: [],
        containerLayerIds: []
      }
    ]
  });
  fs.writeFileSync(ComponentDetection.outputPath, mockOutput, { encoding: 'utf8' });
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
});
