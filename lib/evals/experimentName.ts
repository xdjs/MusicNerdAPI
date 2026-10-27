/**
 * The Braintrust experiment name for one run: `<suite> · <model> · <short sha>`, so the
 * experiment list reads as what was measured, on which model, from which commit
 * (MusicNerdWeb `docs/evals.md`). A model comparison is two branches, not a runtime switch.
 *
 * @param suite - The suite, the eval file's name without `.eval.ts`.
 * @param model - The gateway model id under test.
 * @param sha - The commit that ran.
 * @returns The experiment name.
 */
export function experimentName(suite: string, model: string, sha: string): string {
  return `${suite} · ${model} · ${sha.slice(0, 7)}`;
}
