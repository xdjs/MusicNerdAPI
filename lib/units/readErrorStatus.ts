/**
 * Reads the HTTP status an error-like object carries (`statusCode`, as on `APICallError` and `GatewayError`).
 *
 * @param value - The thrown value or a retry error's last error.
 * @returns The status when it is an integer from 100 to 599; otherwise `undefined`.
 */
export function readErrorStatus(value: unknown): number | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { statusCode } = value as { statusCode?: unknown };
  return Number.isInteger(statusCode) &&
    (statusCode as number) >= 100 &&
    (statusCode as number) <= 599
    ? (statusCode as number)
    : undefined;
}
