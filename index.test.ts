import { jest } from "@jest/globals";

const scanAndGetManifests = jest.fn().mockResolvedValue([]);
const submitSnapshot = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule("./componentDetection", () => ({
  default: { scanAndGetManifests },
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

const priorExitCode = process.exitCode;

beforeEach(() => {
  jest.resetModules();
  scanAndGetManifests.mockReset().mockResolvedValue([]);
  submitSnapshot.mockReset().mockResolvedValue(undefined);
  process.env.GITHUB_RUN_ID = "123";
  process.env.GITHUB_JOB = "dependency-submission";
});

afterEach(() => {
  process.exitCode = priorExitCode;
  delete process.env["INPUT_FAIL-ON-EMPTY"];
  delete process.env.GITHUB_RUN_ID;
  delete process.env.GITHUB_JOB;
});

async function runAction() {
  await import("./index");
  await new Promise((resolve) => setImmediate(resolve));
}

test("does not submit an empty snapshot when manifests are required", async () => {
  process.env["INPUT_FAIL-ON-EMPTY"] = "true";

  await runAction();

  expect(process.exitCode).toBe(1);
  expect(submitSnapshot).not.toHaveBeenCalled();
});

test("still submits an empty snapshot when non-empty results are not required", async () => {
  process.env["INPUT_FAIL-ON-EMPTY"] = "false";

  await runAction();

  expect(process.exitCode).toBe(priorExitCode);
  expect(submitSnapshot).toHaveBeenCalledTimes(1);
});

test("submits detected manifests when non-empty results are required", async () => {
  process.env["INPUT_FAIL-ON-EMPTY"] = "true";
  scanAndGetManifests.mockResolvedValue([{}]);

  await runAction();

  expect(process.exitCode).toBe(priorExitCode);
  expect(submitSnapshot).toHaveBeenCalledTimes(1);
});
