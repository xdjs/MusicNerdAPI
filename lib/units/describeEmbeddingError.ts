import { RetryError } from "ai";
import { EmbeddingInputError } from "@/lib/units/EmbeddingInputError";
import { readErrorStatus } from "@/lib/units/readErrorStatus";

const NAME = /^[A-Za-z_]{1,60}$/;
const KIND = /^[a-z_]{1,40}$/;

/** ` status=` and ` type=` fields read from an error-like object, each only when it has a safe shape. */
function fields(value: unknown): string {
  if (typeof value !== "object" || value === null) return "";
  const { type } = value as { type?: unknown };
  const statusCode = readErrorStatus(value);
  let out = "";
  if (statusCode !== undefined) out += ` status=${statusCode}`;
  if (typeof type === "string" && KIND.test(type)) out += ` type=${type}`;
  return out;
}

/**
 * Names why an embedding call failed without echoing anything the provider sent back.
 *
 * Reads only `name`, `statusCode` and `type`, the properties the AI Gateway errors expose (`GatewayError`: abstract `name`, abstract `type` such as `rate_limit_exceeded`, `statusCode`) and `APICallError` shares in part (`statusCode`). Each is printed only when it has a safe shape.
 *
 * @param error - The thrown value.
 * @returns For a `RetryError`: `<name> <reason> attempts=<n>` plus ` last=<name>`, ` status=` and ` type=` of its last error; for any other error: its name plus ` status=` and ` type=`. Never the message, URL or response body.
 */
export function describeEmbeddingError(error: unknown): string {
  if (error instanceof EmbeddingInputError)
    return `${error.name} input=${error.index}/${error.total} ${describeEmbeddingError(error.cause)}`;
  const name = error instanceof Error ? error.name : "unknown";
  if (RetryError.isInstance(error)) {
    let out = `${name} ${error.reason} attempts=${error.errors.length}`;
    const last: unknown = error.lastError;
    if (typeof last === "object" && last !== null) {
      const lastName = (last as { name?: unknown }).name;
      if (typeof lastName === "string" && NAME.test(lastName)) out += ` last=${lastName}`;
      out += fields(last);
    }
    return out;
  }
  return name + fields(error);
}
