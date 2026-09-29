import { getArtistById } from "@/lib/artists/getArtistById";
import { yieldWhileRunning } from "@/lib/async/yieldWhileRunning";
import { BioConflictError } from "@/lib/bio/BioConflictError";
import { persistArtistBio } from "@/lib/bio/persistArtistBio";
import { buildDocSources } from "@/lib/lore/buildDocSources";
import { generateAboutFromDoc } from "@/lib/lore/generateAboutFromDoc";
import { stripCitationMarkers } from "@/lib/lore/stripCitationMarkers";
import { synthesizeArtistDoc } from "@/lib/lore/synthesizeArtistDoc";
import { DOC_GROUP, NARRATION, TURN_MESSAGES } from "@/lib/onboarding/const";
import type { TurnEvent, TurnOwnership } from "@/lib/onboarding/types";

/**
 * Auto-build stage 3: write the Lore document and the About, streaming both
 * drafts as they're written, and publish them with the bio in one snapshot
 * that also confirms the interview and publish steps. A failure or a bio that
 * changed meanwhile is an error; the saved bio is never touched then.
 *
 * @param artistId - The artist.
 * @param ownership - The user and claim the turn runs under.
 * @param citable - How many sources are citable, for the closing line.
 * @returns The stage's events, ending in `complete` or `error`.
 */
export async function* autoBuildAbout(
  artistId: string,
  ownership: TurnOwnership,
  citable: number,
): AsyncGenerator<TurnEvent> {
  yield { kind: "progress", label: "Writing your About", done: false, group: DOC_GROUP };
  const artist = await getArtistById(artistId);
  const artistName = artist?.name ?? "this artist";
  let wrote = false;
  try {
    const sources = await buildDocSources(artistId);
    const { doc } = yield* yieldWhileRunning<TurnEvent, { doc: string }>(emit =>
      synthesizeArtistDoc(artistId, sources, {
        onTextDelta: delta => emit({ kind: "text-delta", group: DOC_GROUP, call: "doc", delta }),
      }),
    );
    const about = yield* yieldWhileRunning<TurnEvent, string>(emit =>
      generateAboutFromDoc(artistName, doc, sources, {
        onTextDelta: delta => emit({ kind: "text-delta", group: DOC_GROUP, call: "about", delta }),
      }),
    );
    const cleanAbout = stripCitationMarkers(about).trim();
    if (cleanAbout) {
      await persistArtistBio(artistId, cleanAbout, {
        generated: true,
        ownership,
        expectedBio: artist?.bio ?? null,
        document: { content: doc, sources },
        confirmSteps: ["interview", "publish"],
      });
      wrote = true;
    }
  } catch (e) {
    console.error("[onboarding] auto-build About generation failed:", e);
    yield {
      kind: "error",
      message: e instanceof BioConflictError ? e.message : TURN_MESSAGES.autoBuildPublishFailed,
    };
    return;
  }
  yield {
    kind: "progress",
    label: wrote ? "Wrote your About" : "Couldn't write an About yet",
    done: true,
    group: DOC_GROUP,
  };
  if (!wrote) {
    yield { kind: "error", message: TURN_MESSAGES.noAbout };
    return;
  }
  yield { kind: "chat", text: citable > 0 ? NARRATION.built : NARRATION.builtThin };
  yield { kind: "complete" };
}
