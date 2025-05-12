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
  test("returns a empty valid package url from null object", () => {
    const packageUrl = ComponentDetection.makePackageUrl(null);
    expect(packageUrl).toBe("");
  });
  test("returns a empty valid package url from null object properties", () => {
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
