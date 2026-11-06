import { jest } from "@jest/globals";

const scanAndGetManifests = jest.fn().mockResolvedValue([]);
const submitSnapshot = jest.fn().mockResolvedValue(undefined);
const snapshotOutput = jest.fn().mockReturnValue("{}");

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
    prettyJSON() { return snapshotOutput(); }
  },
  submitSnapshot,
}));

const priorExitCode = process.exitCode;

beforeEach(() => {
  jest.resetModules();
  scanAndGetManifests.mockReset().mockResolvedValue([]);
  submitSnapshot.mockReset().mockResolvedValue(undefined);
  snapshotOutput.mockReset().mockReturnValue("{}");
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

test("does not submit manifests that contain no dependencies when required", async () => {
  process.env["INPUT_FAIL-ON-EMPTY"] = "true";
  scanAndGetManifests.mockResolvedValue([{ countDependencies: () => 0 }]);

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
  scanAndGetManifests.mockResolvedValue([{ countDependencies: () => 1 }]);

  await runAction();

  expect(process.exitCode).toBe(priorExitCode);
  expect(submitSnapshot).toHaveBeenCalledTimes(1);
});

test("logs the complete snapshot as ordinary output even beyond the annotation limit", async () => {
  process.env["INPUT_FAIL-ON-EMPTY"] = "false";
  const snapshot = JSON.stringify({
    manifests: { "src/Service.csproj": {
      resolved: Object.fromEntries(Array.from({ length: 100 }, (_, index) => {
        const purl = `pkg:nuget/Example.Dependency${index}@1.0.0`;
        return [purl, { package_url: purl }];
      })),
      file: { source_location: "src/Service.csproj" },
    } },
    sha: "a".repeat(40), ref: "refs/heads/main", job: { id: "123" }, version: 0,
  }, null, 2);
  expect(snapshot.length).toBeGreaterThan(4096);
  snapshotOutput.mockReturnValue(snapshot);
  const output: string[] = [];
  const write = jest.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    output.push(String(chunk));
    return true;
  });
  try {
    await runAction();
    expect(output.join("").includes(`::group::Dependency Snapshot\n${snapshot}\n::endgroup::\n`)).toBe(true);
    expect(submitSnapshot).toHaveBeenCalledTimes(1);
  } finally {
    write.mockRestore();
  }
});
