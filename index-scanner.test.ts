import { jest } from "@jest/globals";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

const originalCwd = process.cwd();
const originalExitCode = process.exitCode;
let scanDirectory: string;

beforeEach(() => {
  jest.resetModules();
  executeScanner.mockReset();
  submitSnapshot.mockClear();
  scanDirectory = mkdtempSync(join(tmpdir(), "component-detection-test-"));
  process.chdir(scanDirectory);
  process.env.GITHUB_RUN_ID = "123";
  process.env.GITHUB_JOB = "dependency-submission";
  process.env["INPUT_FAIL-ON-EMPTY"] = "false";
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(scanDirectory, { recursive: true, force: true });
  process.exitCode = originalExitCode;
  delete process.env.GITHUB_RUN_ID;
  delete process.env.GITHUB_JOB;
  delete process.env["INPUT_FAIL-ON-EMPTY"];
});

async function runActionWithOldResult() {
  writeFileSync("output.json", JSON.stringify({
    componentsFound: [],
    dependencyGraphs: {},
  }));
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
    writeFileSync("output.json", JSON.stringify({
      componentsFound: [],
      dependencyGraphs: {},
    }));
    return 0;
  });

  await import("./index");
  await new Promise((resolve) => setImmediate(resolve));

  expect(process.exitCode).toBe(1);
  expect(submitSnapshot).not.toHaveBeenCalled();
});
