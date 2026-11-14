import { APICallError } from "ai";
import { expect, it } from "vitest";
import { describeEvalError } from "@/lib/evals/describeEvalError";

const drizzleError = (cause: unknown) =>
  Object.assign(new Error("Failed query: select 1\nparams: secret text", { cause }), {
    name: "DrizzleQueryError",
  });

it("reports a database error from the driver's own message, never the wrapping SQL or params", () => {
  const text = describeEvalError(
    drizzleError({ code: "42501", message: "permission denied for schema extensions" }),
  );
  expect(text).toBe("DrizzleQueryError 42501: permission denied for schema extensions");
  expect(text).not.toContain("secret text");
});

it("treats any error whose cause has a string code as a database error", () => {
  const error = new Error("wrapped secret", {
    cause: { code: "42P01", message: 'relation "y" does not exist' },
  });
  expect(describeEvalError(error)).toBe('Error 42P01: relation "y" does not exist');
});

it("reports an APICallError with its status and the first 200 characters of the body", () => {
  const error = new APICallError({
    message: "msg",
    url: "https://example.test",
    requestBodyValues: {},
    statusCode: 429,
    responseBody: "x".repeat(300),
  });
  expect(describeEvalError(error)).toBe(`APICallError 429: ${"x".repeat(200)}`);
});

it("falls back to the message for an APICallError without a body", () => {
  const error = new APICallError({
    message: "bad gateway",
    url: "https://example.test",
    requestBodyValues: {},
    statusCode: 502,
  });
  expect(describeEvalError(error)).toBe("APICallError 502: bad gateway");
});

it("reports another Error by name and the first 300 characters of its message", () => {
  expect(describeEvalError(new TypeError("y".repeat(400)))).toBe(`TypeError: ${"y".repeat(300)}`);
});

it("withholds the message of a drizzle error that lost its class", () => {
  const text = describeEvalError(new Error("Failed query: select\nparams: secret text"));
  expect(text).toBe("Error: database query failed (details withheld)");
});

it("reports a non-Error without its value", () => {
  expect(describeEvalError("secret text")).toBe("non-error thrown");
});
