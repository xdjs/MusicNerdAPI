import { APICallError } from "ai";

const hasCode = (value: unknown): value is { code: string; message?: unknown } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { code?: unknown }).code === "string";

/**
 * A one-line description of an error thrown in an eval task, safe for a public Actions log: never
 * the SQL or bound parameters of a drizzle error (they can hold document text).
 *
 * @param error - The thrown value.
 * @returns The description.
 */
export function describeEvalError(error: unknown): string {
  if (!(error instanceof Error)) return "non-error thrown";
  if (hasCode(error.cause)) {
    return `${error.name} ${error.cause.code}: ${String(error.cause.message ?? "").slice(0, 300)}`;
  }
  if (APICallError.isInstance(error)) {
    return `APICallError ${error.statusCode}: ${(error.responseBody || error.message).slice(0, 200)}`;
  }
  if (error.message.includes("Failed query")) {
    return `${error.name}: database query failed (details withheld)`;
  }
  return `${error.name}: ${error.message.slice(0, 300)}`;
}
