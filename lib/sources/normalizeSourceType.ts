import { SOURCE_TYPES, TYPE_ALIASES } from "@/lib/sources/const";
import type { SourceType } from "@/lib/sources/types";

/**
 * One of our source types from a free-form type name.
 *
 * @param raw - A type name, any case.
 * @returns The type, an alias's type, or "article".
 */
export function normalizeSourceType(raw: string): SourceType {
  const lower = raw.toLowerCase();
  if ((SOURCE_TYPES as readonly string[]).includes(lower)) return lower as SourceType;
  return TYPE_ALIASES[lower] ?? "article";
}
