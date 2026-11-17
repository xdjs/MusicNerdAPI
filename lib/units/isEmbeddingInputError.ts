import { RetryError } from "ai";
import { readErrorStatus } from "@/lib/units/readErrorStatus";

const INPUT_STATUSES = new Set([400, 413, 422]);

/**
 * Tells whether an embedding failure is caused by the input itself, so that splitting the batch can find the culprit.
 *
 * True when the provider answered 400, 413 or 422, directly or as the last error of a `RetryError` whose reason is `errorNotRetryable`. Rate limits, server errors, auth errors, network errors, aborts and errors without a status are not input errors.
 *
 * @param error - The thrown value.
 * @returns Whether the failure is an input error.
 */
export function isEmbeddingInputError(error: unknown): boolean {
  if (RetryError.isInstance(error)) {
    return (
      error.reason === "errorNotRetryable" &&
      INPUT_STATUSES.has(readErrorStatus(error.lastError) ?? 0)
    );
  }
  return INPUT_STATUSES.has(readErrorStatus(error) ?? 0);
}
