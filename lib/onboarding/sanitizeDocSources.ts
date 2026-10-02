import type { DocSource } from "@/lib/lore/types";
import { MAX_DOC_SOURCES } from "@/lib/onboarding/const";

/**
 * A client-echoed citation manifest, validated before it's stored. Anything
 * malformed is dropped rather than failing the publish.
 *
 * @param input - What the client sent.
 * @returns The well-formed entries, at most 200.
 */
export function sanitizeDocSources(input: unknown): DocSource[] {
  if (!Array.isArray(input)) return [];
  const out: DocSource[] = [];
  for (const item of input.slice(0, MAX_DOC_SOURCES)) {
    if (!item || typeof item !== "object") continue;
    const { id, kind, label, url } = item as Record<string, unknown>;
    if (typeof id !== "number" || !Number.isFinite(id)) continue;
    if (kind !== "vault" && kind !== "interview" && kind !== "social") continue;
    if (typeof label !== "string") continue;
    if (url !== null && typeof url !== "string") continue;
    out.push({ id, kind, label, url: url ?? null });
  }
  return out;
}
