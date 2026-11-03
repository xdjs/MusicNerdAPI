import { createHash } from "node:crypto";

/** Fingerprint the saved vault evidence consumed by Lore; never expose its source text. */
export function vaultSourceRevision(source: {
  url: string;
  extractedText?: string | null;
  title?: string | null;
  snippet?: string | null;
  publishedAt?: string | null;
  filePath?: string | null;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        source.url,
        source.extractedText ?? null,
        source.title ?? null,
        source.snippet ?? null,
        source.publishedAt ?? null,
        source.filePath ?? null,
      ]),
    )
    .digest("hex");
}
