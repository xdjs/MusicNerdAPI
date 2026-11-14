import { APICallError } from "ai";

const hasCode = (value: unknown): value is { code: string; message?: unknown } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { code?: unknown }).code === "string";

/**
 * SQLSTATE classes whose driver messages name database objects (tables, columns, functions,
 * schemas, hosts) and never row data: 42 (syntax error or access rule violation), 3F (invalid
 * schema name) and 08 (connection exception). Every other class, such as 22 (data exception) and
 * 23 (integrity constraint), can echo a value ("invalid input syntax for type uuid: ...").
 */
const MESSAGE_SAFE_SQLSTATE_CLASSES = new Set(["42", "3F", "08"]);

/**
 * A one-line description of an error thrown in an eval task, safe for a public Actions log. It
 * follows an allowlist, because free-text messages can carry data values or text echoed by a
 * provider, and a drizzle error also wraps the SQL and bound parameters (document text):
 *
 * - Database error (the cause has a string SQLSTATE `code`): the name and code; the driver message
 *   (first 200 characters) only for the SQLSTATE classes 42, 3F and 08.
 * - `APICallError`: the status code only, never the body or message.
 * - Any other `Error`: the name only. With `EVAL_DEBUG_ERRORS=1` also the first 300 characters of
 *   the message, still withholding any message that contains "Failed query".
 * - A non-Error: a fixed string, never the value.
 *
 * @param error - The thrown value.
 * @returns The description.
 */
export function describeEvalError(error: unknown): string {
  if (!(error instanceof Error)) return "non-error thrown";
  if (hasCode(error.cause)) {
    const { code, message } = error.cause;
    const head = `${error.name} ${code}`;
    if (!MESSAGE_SAFE_SQLSTATE_CLASSES.has(code.slice(0, 2).toUpperCase())) return head;
    return `${head}: ${String(message ?? "").slice(0, 200)}`;
  }
  if (APICallError.isInstance(error)) return `APICallError ${error.statusCode}`;
  if (process.env.EVAL_DEBUG_ERRORS === "1" && !error.message.includes("Failed query")) {
    return `${error.name}: ${error.message.slice(0, 300)}`;
  }
  return error.name;
}
