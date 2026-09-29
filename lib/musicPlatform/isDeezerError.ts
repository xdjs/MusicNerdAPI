/**
 * Deezer reports errors inside a 200 body, as `{ error: {...} }`.
 *
 * @param data - A parsed Deezer response.
 * @returns True when it is an error object.
 */
export function isDeezerError(data: unknown): data is { error: { type: string; message: string } } {
  return (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as Record<string, unknown>).error === "object"
  );
}
