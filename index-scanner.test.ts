import { jest } from "@jest/globals";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const executeScanner = jest.fn();
const submitSnapshot = jest.fn().mockResolvedValue(undefined);
const getRelease = jest.fn().mockRejectedValue(new Error("release unavailable"));
const download: jest.MockedFunction<typeof fetch> = jest.fn();
const warning = jest.fn();
const errorLog = jest.fn();

jest.unstable_mockModule("@actions/exec", () => ({ exec: executeScanner }));
jest.unstable_mockModule("undici", () => ({
  EnvHttpProxyAgent: class {},
  fetch: download,
}));
const core = await import("@actions/core");
jest.unstable_mockModule("@actions/core", () => ({
  ...core,
  warning,
  error: errorLog,
}));
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
  getRelease.mockReset().mockRejectedValue(new Error("release unavailable"));
  download.mockReset();
  warning.mockClear();
  errorLog.mockClear();
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
  jest.useRealTimers();
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
  jest.useFakeTimers();
  executeScanner.mockImplementation(async () => {
    writeFileSync(scanResultPath, emptyScanResult);
    return 0;
  });

  await import("./index");
  await jest.runAllTimersAsync();

  expect(process.exitCode).toBe(1);
  expect(submitSnapshot).not.toHaveBeenCalled();
  expect(executeScanner).not.toHaveBeenCalled();
  expect(getRelease).toHaveBeenCalledTimes(3);
});

describe("detector acquisition", () => {
  const assetURL = "https://github.com/microsoft/component-detection/releases/download/test/component-detection";

  beforeEach(() => {
    jest.useFakeTimers();
    getRelease.mockResolvedValue({
      data: {
        assets: [{
          name: process.platform === "win32" ? "component-detection-win-x64.exe" : "component-detection-linux-x64",
          browser_download_url: assetURL,
        }],
      },
    });
  });

  test("retries two HTTP failures and writes only the successful binary", async () => {
    download
      .mockResolvedValueOnce(new Response("<html>error</html>", { status: 503, statusText: "Service Unavailable" }))
      .mockResolvedValueOnce(new Response("rate limited", { status: 429, statusText: "Too Many Requests" }))
      .mockResolvedValueOnce(new Response("detector binary"));
    const { default: detection } = await import("./componentDetection");

    const acquisition = detection.downloadLatestRelease();
    await jest.advanceTimersByTimeAsync(0);
    expect(existsSync(detection.componentDetectionPath)).toBe(false);
    await jest.advanceTimersByTimeAsync(1000);
    expect(existsSync(detection.componentDetectionPath)).toBe(false);
    await jest.advanceTimersByTimeAsync(2000);
    await acquisition;

    expect(download).toHaveBeenCalledTimes(3);
    expect(readFileSync(detection.componentDetectionPath, "utf8")).toBe("detector binary");
    expect(warning).toHaveBeenNthCalledWith(1, expect.stringContaining("HTTP 503 Service Unavailable"));
    expect(warning).toHaveBeenNthCalledWith(2, expect.stringContaining("HTTP 429 Too Many Requests"));
    expect(errorLog).not.toHaveBeenCalled();
  });

  test("does not overwrite or execute a previous binary after three HTTP failures", async () => {
    download.mockImplementation(async () =>
      new Response("<html>error</html>", { status: 502, statusText: "Bad Gateway" })
    );
    const { default: detection } = await import("./componentDetection");
    writeFileSync(detection.componentDetectionPath, "previous binary");

    await import("./index");
    await jest.runAllTimersAsync();

    expect(download).toHaveBeenCalledTimes(3);
    expect(readFileSync(detection.componentDetectionPath, "utf8")).toBe("previous binary");
    expect(executeScanner).not.toHaveBeenCalled();
    expect(submitSnapshot).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(warning).toHaveBeenCalledTimes(2);
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("attempt 3/3"));
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("HTTP 502 Bad Gateway"));
  });

  test.each(["request", "response body"])("retries release lookup and an interrupted %s", async (failure) => {
    getRelease.mockRejectedValueOnce(new Error("release connection reset"));
    if (failure === "request") {
      download.mockRejectedValueOnce(new Error("download interrupted"));
    } else {
      download.mockResolvedValueOnce(new Response(new ReadableStream({
        start(controller) {
          controller.error(new Error("download interrupted"));
        },
      })));
    }
    download.mockResolvedValueOnce(new Response("detector binary"));
    const { default: detection } = await import("./componentDetection");

    const acquisition = detection.downloadLatestRelease();
    await jest.runAllTimersAsync();
    await acquisition;

    expect(getRelease).toHaveBeenCalledTimes(3);
    expect(download).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenNthCalledWith(1, expect.stringContaining("release connection reset"));
    expect(warning).toHaveBeenNthCalledWith(2, expect.stringContaining("download interrupted"));
    expect(readFileSync(detection.componentDetectionPath, "utf8")).toBe("detector binary");
  });

  test("succeeds immediately without retrying", async () => {
    download.mockResolvedValue(new Response("detector binary"));
    const { default: detection } = await import("./componentDetection");

    await detection.downloadLatestRelease();

    expect(getRelease).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledTimes(1);
    expect(warning).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    expect(readFileSync(detection.componentDetectionPath, "utf8")).toBe("detector binary");
  });

  test("reports a missing platform asset without downloading or writing it", async () => {
    getRelease.mockResolvedValue({ data: { assets: [] } });
    const { default: detection } = await import("./componentDetection");
    const rejection = expect(detection.downloadLatestRelease()).rejects.toThrow("No Component Detection release asset");

    await jest.runAllTimersAsync();
    await rejection;

    expect(download).not.toHaveBeenCalled();
    expect(existsSync(detection.componentDetectionPath)).toBe(false);
  });
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
