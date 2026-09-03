const MAX_SUBMISSION_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(() => resolve(), milliseconds));

export async function retrySnapshotSubmission(
  submit: () => Promise<void>,
  warn: (message: string) => void,
  wait: (milliseconds: number) => Promise<void> = delay
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_SUBMISSION_ATTEMPTS; attempt++) {
    try {
      await submit();
      return;
    } catch (error) {
      if (attempt === MAX_SUBMISSION_ATTEMPTS) {
        throw error;
      }

      warn(
        `Snapshot submission failed (attempt ${attempt}/${MAX_SUBMISSION_ATTEMPTS}). Retrying...`
      );
      await wait(RETRY_DELAY_MS * attempt);
    }
  }
}
