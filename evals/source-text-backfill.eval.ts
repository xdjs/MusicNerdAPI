import { Eval } from "braintrust";
import { EVAL_ARTIST_IDS } from "@/lib/evals/evalArtists";
import { experimentName } from "@/lib/evals/experimentName";
import { describeEvalError } from "@/lib/evals/describeEvalError";
import { runSourceTextBackfill } from "@/lib/evals/runSourceTextBackfill";

/**
 * Fetches and saves the text of approved link documents that have none, for the eval suites'
 * artists (`evalArtists.ts`), on the staging database. A third of production's approved Lore
 * documents have no saved text (measured 2026-11-15) because they were approved before the
 * `source_extract` job existed; this suite measures how many of such pages the job's reader can
 * read (our fetcher, then Tavily's extract when a site refuses it) and fills them on staging. Run `units-backfill` afterwards to index what was saved. No model
 * request is made; Tavily's extract (1 credit per 5 pages) is called only for pages our fetcher
 * could not read. Output is counts, hosts and fetch statuses: no titles, paths or text.
 *
 *   hosted: the Evals workflow, suite `source-text-backfill`
 */

const SHA = process.env.GITHUB_SHA ?? "local";

Eval("music-nerd", {
  experimentName: experimentName("source-text-backfill", "readSourceText", SHA),
  metadata: { suite: "source-text-backfill", sha: SHA },
  maxConcurrency: 1,
  data: () => EVAL_ARTIST_IDS.map(artistId => ({ input: { artistId }, metadata: { artistId } })),
  task: async (input: { artistId: string }) => {
    try {
      const result = await runSourceTextBackfill(input.artistId);
      console.log(
        `[source-text-backfill] ${input.artistId} missing=${result.missing} saved=${result.saved} savedChars=${result.savedChars} viaTavily=${result.viaTavily} outcomes=${JSON.stringify(result.outcomes)} failures=${JSON.stringify(result.failures)}`,
      );
      return result;
    } catch (error) {
      const diagnostic = describeEvalError(error);
      console.error(`[source-text-backfill] ${input.artistId}: ${diagnostic}`);
      // Rethrown as the diagnostic: the original message can hold SQL and bound parameters.
      throw new Error(diagnostic);
    }
  },
  scores: [
    ({ output }) => ({
      name: "text_saved",
      // The share of text-less documents that now have text; 1 when there was nothing to fetch.
      score: output.missing === 0 ? 1 : output.saved / output.missing,
    }),
  ],
});
