import { createHash } from "node:crypto";

/** Pin every normalized field and row order, without retaining or exposing source text. */
export function getChatCorpusFingerprint(originals: unknown[]): string {
  const encoded = JSON.stringify(originals, (_key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map(key => [key, value[key]]),
        )
      : value,
  );
  return createHash("sha256").update(encoded).digest("hex");
}
