import { jest } from "@jest/globals";
import { retrySnapshotSubmission } from "./snapshotSubmission";

describe("retrySnapshotSubmission", () => {
  test("retries a failed submission and succeeds", async () => {
    const submit = jest
      .fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce(undefined);
    const wait = jest.fn().mockResolvedValue(undefined);

    await retrySnapshotSubmission(submit, jest.fn(), wait);

    expect(submit).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(1000);
  });

  test("fails after the final submission attempt", async () => {
    const error = new Error("temporary failure");
    const submit = jest.fn().mockRejectedValue(error);
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(retrySnapshotSubmission(submit, jest.fn(), wait)).rejects.toThrow(error);

    expect(submit).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenNthCalledWith(1, 1000);
    expect(wait).toHaveBeenNthCalledWith(2, 2000);
  });
});
