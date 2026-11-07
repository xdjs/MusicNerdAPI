import { isDeepStrictEqual } from "node:util";
import type { ResearchOriginal } from "../questionResearch/types";

type Options = {
  initialSources: ResearchOriginal[];
  loadCurrent: () => Promise<ResearchOriginal[]>;
  assertLegacy: (source: ResearchOriginal) => Promise<void>;
};

/**
 * Recheck every source prefix against one freshly loaded public corpus per batch.
 * Full immutable records, rather than revision labels alone, bind output to the
 * initial read. The loader determines eligibility; this adds no new publication
 * policy and cannot make the later output atomic with its database snapshot.
 */
export function createExposedSourceValidator(options: Options) {
  const index = (sources: ResearchOriginal[]) => {
    const result = new Map<string, ResearchOriginal>();
    for (const source of sources) {
      if (typeof source.sourceId !== "string" || !source.sourceId || result.has(source.sourceId)) {
        throw new Error("Ambiguous exposed source identity");
      }
      result.set(source.sourceId, source);
    }
    return result;
  };
  const initial = index(structuredClone(options.initialSources));
  // Capture callbacks as well as data so caller mutation cannot replace guards.
  const { loadCurrent, assertLegacy } = options;
  return {
    async validate(sources: ResearchOriginal[]): Promise<void> {
      // Snapshot before awaiting: changes to caller-owned arrays/records cannot
      // change which original this batch authorizes.
      const selected = index(structuredClone(sources));
      if (!selected.size) return;
      const current = index(structuredClone(await loadCurrent()));
      for (const [id, source] of selected) {
        const expected = initial.get(id);
        const fresh = current.get(id);
        // Include complete text, URLs, dates, curation, evidence/speaker types,
        // truncation and any future policy metadata, not a narrow field subset.
        if (
          !expected ||
          !fresh ||
          !isDeepStrictEqual(source, expected) ||
          !isDeepStrictEqual(fresh, expected)
        ) {
          throw new Error("Exposed source changed or is no longer public");
        }
      }
      // Legacy prefix-specific checks are additional guards, never the sole
      // authorization for unrecognized prefixes. Give each guard a private copy.
      await Promise.all(
        [...selected.values()].map(source => assertLegacy(structuredClone(source))),
      );
    },
  };
}
