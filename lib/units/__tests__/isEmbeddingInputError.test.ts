import { APICallError, RetryError } from "ai";
import { describe, expect, test } from "vitest";
import { isEmbeddingInputError } from "@/lib/units/isEmbeddingInputError";

const apiError = (statusCode?: number) =>
  new APICallError({ message: "m", url: "https://x.example", requestBodyValues: {}, statusCode });
const retry = (reason: "errorNotRetryable" | "maxRetriesExceeded" | "abort", last: unknown) =>
  new RetryError({ message: "m", reason, errors: [last] });

describe("isEmbeddingInputError", () => {
  test.each([400, 413, 422])("is true for a direct %i", status => {
    expect(isEmbeddingInputError(apiError(status))).toBe(true);
  });

  test("is true for a non-retryable retry error whose last error is 400", () => {
    expect(isEmbeddingInputError(retry("errorNotRetryable", apiError(400)))).toBe(true);
  });

  test.each([401, 403, 429, 500, 503])("is false for a direct %i", status => {
    expect(isEmbeddingInputError(apiError(status))).toBe(false);
  });

  test("is false for a retry-exhausted error, even with an input status", () => {
    expect(isEmbeddingInputError(retry("maxRetriesExceeded", apiError(500)))).toBe(false);
    expect(isEmbeddingInputError(retry("maxRetriesExceeded", apiError(400)))).toBe(false);
  });

  test("is false for a non-retryable retry error with a non-input status", () => {
    expect(isEmbeddingInputError(retry("errorNotRetryable", apiError(401)))).toBe(false);
  });

  test("is false for aborts, network errors, plain errors and non-errors", () => {
    expect(isEmbeddingInputError(new DOMException("aborted", "AbortError"))).toBe(false);
    expect(isEmbeddingInputError(new TypeError("fetch failed"))).toBe(false);
    expect(isEmbeddingInputError(new Error("approved request/spend envelope exhausted"))).toBe(
      false,
    );
    expect(isEmbeddingInputError(retry("abort", new Error("x")))).toBe(false);
    expect(isEmbeddingInputError(undefined)).toBe(false);
    expect(isEmbeddingInputError("400")).toBe(false);
  });

  test("reads a statusCode on any error-like object", () => {
    expect(isEmbeddingInputError({ statusCode: 422 })).toBe(true);
    expect(isEmbeddingInputError({ statusCode: "400" })).toBe(false);
  });
});
