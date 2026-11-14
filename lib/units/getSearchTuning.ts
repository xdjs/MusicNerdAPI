import { MAX_UNITS_PER_DOCUMENT, SEARCH_CANDIDATES } from "@/lib/units/types";

/** The ranking knobs of `searchUnits`; the defaults are the production ranking. */
export type SearchTuning = {
  /** The most units of one document among the hits. */
  maxUnitsPerDocument: number;
  /** `and`: every word must match (`websearch_to_tsquery`); `or`: any non-stopword term may. */
  textMode: "and" | "or";
  /** The length of each candidate list, text and vector, before fusion. */
  candidates: number;
};

const integerIn = (value: string | undefined, min: number, max: number, fallback: number) => {
  const trimmed = value?.trim() ?? "";
  if (!/^\d+$/.test(trimmed)) return fallback;
  const n = Number(trimmed);
  return n >= min && n <= max ? n : fallback;
};

/**
 * The search tuning for this process, so ranking variants can be compared from the eval workflow
 * without code edits. Unset or invalid values keep the default.
 *
 * @param env - The environment: `UNITS_MAX_PER_DOCUMENT` (integer 1..8, default
 * `MAX_UNITS_PER_DOCUMENT`), `UNITS_TEXT_MODE` (`and` or `or`, default `and`) and
 * `UNITS_CANDIDATES` (integer 10..60, default `SEARCH_CANDIDATES`).
 * @returns The effective tuning.
 */
export function getSearchTuning(
  env: Record<string, string | undefined> = process.env,
): SearchTuning {
  const mode = env.UNITS_TEXT_MODE?.trim().toLowerCase();
  return {
    maxUnitsPerDocument: integerIn(env.UNITS_MAX_PER_DOCUMENT, 1, 8, MAX_UNITS_PER_DOCUMENT),
    textMode: mode === "or" ? "or" : "and",
    candidates: integerIn(env.UNITS_CANDIDATES, 10, 60, SEARCH_CANDIDATES),
  };
}
