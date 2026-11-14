import { APICallError } from "ai";
import { afterEach, expect, it, vi } from "vitest";
import { describeEvalError } from "@/lib/evals/describeEvalError";

const drizzleError = (cause: unknown) =>
  Object.assign(new Error("Failed query: select 1\nparams: secret text", { cause }), {
    name: "DrizzleQueryError",
  });

afterEach(() => {
  vi.unstubAllEnvs();
});

it("keeps the driver's message for a class 42 code, never the wrapping SQL or params", () => {
  const text = describeEvalError(
    drizzleError({ code: "42501", message: "permission denied for schema extensions" }),
  );
  expect(text).toBe("DrizzleQueryError 42501: permission denied for schema extensions");
  expect(text).not.toContain("secret text");
  expect(text).not.toContain("Failed query");
});

it("keeps the message for classes 3F and 08, cut to 200 characters", () => {
  expect(
    describeEvalError(drizzleError({ code: "3F000", message: 'schema "x" does not exist' })),
  ).toBe('DrizzleQueryError 3F000: schema "x" does not exist');
  expect(describeEvalError(drizzleError({ code: "08006", message: "m".repeat(300) }))).toBe(
    `DrizzleQueryError 08006: ${"m".repeat(200)}`,
  );
});

it("treats any error whose cause has a string code as a database error", () => {
  const error = new Error("wrapped secret", {
    cause: { code: "42P01", message: 'relation "y" does not exist' },
  });
  expect(describeEvalError(error)).toBe('Error 42P01: relation "y" does not exist');
});

it("returns the name and code only for a data exception such as 22P02", () => {
  const text = describeEvalError(
    drizzleError({ code: "22P02", message: 'invalid input syntax for type uuid: "secret"' }),
  );
  expect(text).toBe("DrizzleQueryError 22P02");
  expect(text).not.toContain("secret");
});

it("returns the name and code only for an integrity constraint violation", () => {
  expect(
    describeEvalError(
      drizzleError({ code: "23505", message: "Key (email)=(a@b.c) already exists" }),
    ),
  ).toBe("DrizzleQueryError 23505");
});

it("reports an APICallError by status only, never the body or message", () => {
  const error = new APICallError({
    message: "echoed secret",
    url: "https://example.test",
    requestBodyValues: {},
    statusCode: 429,
    responseBody: "secret body",
  });
  expect(describeEvalError(error)).toBe("APICallError 429");
});

it("reports another Error by name only by default", () => {
  expect(describeEvalError(new TypeError("secret text"))).toBe("TypeError");
});

it("adds the first 300 characters of the message when EVAL_DEBUG_ERRORS is 1", () => {
  vi.stubEnv("EVAL_DEBUG_ERRORS", "1");
  expect(describeEvalError(new TypeError("y".repeat(400)))).toBe(`TypeError: ${"y".repeat(300)}`);
});

it("keeps the message out unless the flag is exactly 1", () => {
  vi.stubEnv("EVAL_DEBUG_ERRORS", "true");
  expect(describeEvalError(new TypeError("secret text"))).toBe("TypeError");
});

it("never shows drizzle Failed query text, with or without the flag", () => {
  const lost = new Error("Failed query: select\nparams: secret text");
  expect(describeEvalError(lost)).toBe("Error");
  vi.stubEnv("EVAL_DEBUG_ERRORS", "1");
  const text = describeEvalError(lost);
  expect(text).toBe("Error");
  expect(text).not.toContain("secret text");
  expect(describeEvalError(drizzleError({ code: "22P02", message: "secret" }))).not.toContain(
    "Failed query",
  );
});

it("reports a non-Error without its value", () => {
  expect(describeEvalError("secret text")).toBe("non-error thrown");
});
