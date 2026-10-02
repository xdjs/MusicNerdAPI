import { getArtistById } from "@/lib/artists/getArtistById";
import type { LinkDecisionRun } from "@/lib/onboarding/types";

/**
 * The artist's name, read at most once per run and only when a check needs it.
 *
 * @param run - The link-decision run.
 * @returns The name, or "" when the artist has none.
 */
export async function artistNameForRun(run: LinkDecisionRun): Promise<string> {
  if (run.artistName === undefined) {
    run.artistName = (await getArtistById(run.artistId))?.name ?? "";
  }
  return run.artistName;
}
