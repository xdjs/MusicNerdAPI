import type { ActiveRelationsResult } from "@/lib/musicbrainz/types";

/**
 * A MusicBrainz entry's relations that have not ended.
 *
 * @param data - The entry, as MusicBrainz returned it.
 * @returns The active relations, or invalid when `relations` is malformed.
 */
export function activeRelations(data: Record<string, unknown> | null): ActiveRelationsResult {
  const relations = data?.relations;
  if (!Array.isArray(relations)) return { status: "invalid" };
  const active: Array<Record<string, unknown>> = [];
  for (const relation of relations) {
    if (!relation || typeof relation !== "object" || Array.isArray(relation))
      return { status: "invalid" };
    const record = relation as Record<string, unknown>;
    if ("ended" in record && typeof record.ended !== "boolean") return { status: "invalid" };
    if (record.ended !== true) active.push(record);
  }
  return { status: "ok", relations: active };
}
