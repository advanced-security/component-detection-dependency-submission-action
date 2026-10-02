import { jest } from "@jest/globals";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const executeScanner = jest.fn();
const submitSnapshot = jest.fn().mockResolvedValue(undefined);
const getRelease = jest.fn().mockRejectedValue(new Error("release unavailable"));

jest.unstable_mockModule("@actions/exec", () => ({ exec: executeScanner }));
jest.unstable_mockModule("octokit", () => ({
  Octokit: class {
    request = getRelease;
  },
}));
jest.unstable_mockModule("@github/dependency-submission-toolkit", () => ({
  PackageCache: class {},
  BuildTarget: class {},
  Package: class {},
  Manifest: class {},
  Snapshot: class {
    addManifest() {}
  },
  submitSnapshot,
}));

const emptyScanResult = JSON.stringify({
  componentsFound: [],
  dependencyGraphs: {},
});

const originalCwd = process.cwd();
const originalExitCode = process.exitCode;
const originalRunnerTemp = process.env.RUNNER_TEMP;
let scanDirectory: string;
let runnerTempDirectory: string;
let scanResultPath: string;

beforeEach(() => {
  jest.resetModules();
  executeScanner.mockReset();
  submitSnapshot.mockClear();
  scanDirectory = mkdtempSync(join(tmpdir(), "component-detection-test-"));
  runnerTempDirectory = mkdtempSync(join(tmpdir(), "component-detection-temp-"));
  scanResultPath = join(runnerTempDirectory, "component-detection-output.json");
  process.chdir(scanDirectory);
  process.env.RUNNER_TEMP = runnerTempDirectory;
  process.env.GITHUB_RUN_ID = "123";
  process.env.GITHUB_JOB = "dependency-submission";
  process.env["INPUT_FAIL-ON-EMPTY"] = "false";
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(scanDirectory, { recursive: true, force: true });
  rmSync(runnerTempDirectory, { recursive: true, force: true });
  process.exitCode = originalExitCode;
  if (originalRunnerTemp === undefined) {
    delete process.env.RUNNER_TEMP;
  } else {
    process.env.RUNNER_TEMP = originalRunnerTemp;
  }
  delete process.env.GITHUB_RUN_ID;
  delete process.env.GITHUB_JOB;
  delete process.env["INPUT_FAIL-ON-EMPTY"];
});

async function runActionWithOldResult() {
  writeFileSync(scanResultPath, emptyScanResult);
  const { default: detection } = await import("./componentDetection");
  jest.spyOn(detection, "downloadLatestRelease").mockResolvedValue(undefined);

  await import("./index");
  await new Promise((resolve) => setImmediate(resolve));
}

test("does not submit a previous scan's result after the scanner fails", async () => {
  executeScanner.mockRejectedValue(new Error("scanner failed"));

  await runActionWithOldResult();

  expect(process.exitCode).toBe(1);
  expect(submitSnapshot).not.toHaveBeenCalled();
});

test("does not submit a previous scan's result when no fresh output is written", async () => {
  executeScanner.mockResolvedValue(0);

  await runActionWithOldResult();

  expect(process.exitCode).toBe(1);
  expect(submitSnapshot).not.toHaveBeenCalled();
});

test("does not submit when the scanner cannot be downloaded", async () => {
  executeScanner.mockImplementation(async () => {
    writeFileSync(scanResultPath, emptyScanResult);
    return 0;
  });

  await import("./index");
  await new Promise((resolve) => setImmediate(resolve));

  expect(process.exitCode).toBe(1);
  expect(submitSnapshot).not.toHaveBeenCalled();
});

test("leaves a repository's own output.json untouched", async () => {
  const repositoryFile = join(scanDirectory, "output.json");
  const repositoryContents = JSON.stringify({ keep: "this" });
  writeFileSync(repositoryFile, repositoryContents);
  executeScanner.mockImplementation(async () => {
    writeFileSync(scanResultPath, emptyScanResult);
    return 0;
  });

  const { default: detection } = await import("./componentDetection");
  jest.spyOn(detection, "downloadLatestRelease").mockResolvedValue(undefined);

  await import("./index");
  await new Promise((resolve) => setImmediate(resolve));

  expect(submitSnapshot).toHaveBeenCalledTimes(1);
  expect(readFileSync(repositoryFile, "utf8")).toBe(repositoryContents);
  expect(existsSync(scanResultPath)).toBe(false);
});
