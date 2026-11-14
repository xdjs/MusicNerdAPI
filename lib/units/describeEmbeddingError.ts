import { APICallError, RetryError } from "ai";

/**
 * Names why an embedding call failed without echoing anything the provider sent back.
 *
 * @param error - The thrown value.
 * @returns The error name, plus the retry reason and provider status code when the AI SDK reports them; never the message, URL or response body.
 */
export function describeEmbeddingError(error: unknown): string {
  const name = error instanceof Error ? error.name : "unknown";
  const parts = [name];
  let call: unknown = error;
  if (RetryError.isInstance(error)) {
    parts.push(error.reason);
    call = error.lastError;
  }
  if (APICallError.isInstance(call) && call.statusCode !== undefined) {
    parts.push(String(call.statusCode));
  }
  return parts.join(" ");
}
