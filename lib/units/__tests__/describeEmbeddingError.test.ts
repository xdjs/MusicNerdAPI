import { APICallError, RetryError } from "ai";
import { describe, expect, test } from "vitest";
import { EmbeddingInputError } from "@/lib/units/EmbeddingInputError";
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
    expect(describeEmbeddingError(error)).toBe(
      "AI_RetryError maxRetriesExceeded attempts=1 last=AI_APICallError status=429",
    );
  });

  test("names a retry error whose last error has no status", () => {
    const error = new RetryError({
      message: "m",
      reason: "maxRetriesExceeded",
      errors: [new TypeError("x")],
    });
    expect(describeEmbeddingError(error)).toBe(
      "AI_RetryError maxRetriesExceeded attempts=1 last=TypeError",
    );
  });

  test("names a direct API call error with its status", () => {
    expect(describeEmbeddingError(apiError(400))).toBe("AI_APICallError status=400");
  });

  test("returns only the name of any other error, never the message", () => {
    expect(describeEmbeddingError(new TypeError("secret page text"))).toBe("TypeError");
    expect(describeEmbeddingError("secret page text")).toBe("unknown");
  });

  const retry = (last: unknown) =>
    new RetryError({ message: "m", reason: "maxRetriesExceeded", errors: [last, last, last] });

  test("reads a gateway-style last error by shape", () => {
    const out = describeEmbeddingError(
      retry({
        name: "GatewayRateLimitError",
        statusCode: 429,
        type: "rate_limit_exceeded",
        message: "secret text",
      }),
    );
    expect(out).toBe(
      "AI_RetryError maxRetriesExceeded attempts=3 last=GatewayRateLimitError status=429 type=rate_limit_exceeded",
    );
    expect(out).not.toContain("secret text");
  });

  test("omits a type with spaces or over 40 characters and a non-integer status", () => {
    expect(
      describeEmbeddingError(retry({ name: "E", type: "has spaces", statusCode: 429.5 })),
    ).toBe("AI_RetryError maxRetriesExceeded attempts=3 last=E");
    expect(describeEmbeddingError(retry({ type: "a".repeat(41), statusCode: 99 }))).toBe(
      "AI_RetryError maxRetriesExceeded attempts=3",
    );
  });

  test("reads status and type from a non-retry error itself", () => {
    const error = Object.assign(new Error("secret text"), {
      name: "GatewayInternalServerError",
      statusCode: 500,
      type: "internal_server_error",
    });
    expect(describeEmbeddingError(error)).toBe(
      "GatewayInternalServerError status=500 type=internal_server_error",
    );
  });

  test("renders an input error with its position and its cause", () => {
    const cause = new RetryError({
      message: "m",
      reason: "maxRetriesExceeded",
      errors: [{ name: "GatewayResponseError", statusCode: 500, type: "response_error" }],
    });
    const out = describeEmbeddingError(new EmbeddingInputError(17, 40, cause));
    expect(out).toBe(
      "EmbeddingInputError input=17/40 AI_RetryError maxRetriesExceeded attempts=1 last=GatewayResponseError status=500 type=response_error",
    );
  });
});
