import { APICallError, RetryError } from "ai";
import { describe, expect, test } from "vitest";
import { describeEmbeddingError } from "@/lib/units/describeEmbeddingError";

const apiError = (statusCode?: number) =>
  new APICallError({
    message: "secret page text",
    url: "https://gateway.example/secret",
    requestBodyValues: { input: "secret page text" },
    statusCode,
    responseBody: "secret page text",
  });

describe("describeEmbeddingError", () => {
  test("names a retry error with its reason and the last error's status", () => {
    const error = new RetryError({
      message: "secret page text",
      reason: "maxRetriesExceeded",
      errors: [apiError(429)],
    });
    expect(describeEmbeddingError(error)).toBe("AI_RetryError maxRetriesExceeded 429");
  });

  test("names a retry error whose last error has no status", () => {
    const error = new RetryError({
      message: "m",
      reason: "maxRetriesExceeded",
      errors: [new TypeError("x")],
    });
    expect(describeEmbeddingError(error)).toBe("AI_RetryError maxRetriesExceeded");
  });

  test("names a direct API call error with its status", () => {
    expect(describeEmbeddingError(apiError(400))).toBe("AI_APICallError 400");
  });

  test("returns only the name of any other error, never the message", () => {
    expect(describeEmbeddingError(new TypeError("secret page text"))).toBe("TypeError");
    expect(describeEmbeddingError("secret page text")).toBe("unknown");
  });
});
