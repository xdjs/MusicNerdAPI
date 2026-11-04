import { validateSetupLore } from "@/lib/onboarding/validateSetupLore";
import { LoreChangedError } from "@/lib/lore/LoreChangedError";
import { isRealBio } from "@/lib/bio/isRealBio";
import { hasPinnedBio } from "@/lib/bio/hasPinnedBio";
import { getArtistDocStrict } from "@/lib/lore/getArtistDocStrict";
import { persistSetupLore } from "@/lib/onboarding/persistSetupLore";
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
 * Auto-build stage 3: prepare Lore and fill an empty About. Existing real text
 * and pins are preserved, including edits made during generation. Lore and
 * setup confirmations commit together under ownership and snapshot guards.
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
  yield { kind: "progress", label: "Preparing your Lore and About", done: false, group: DOC_GROUP };
  const artist = await getArtistById(artistId);
  const artistName = artist?.name ?? "this artist";
  let wrote = false;
  let preserved = false;
  let retainedLore = false;
  try {
    const preserve = isRealBio(artist?.bio) || (await hasPinnedBio(artistId));
    const previousDoc = await getArtistDocStrict(artistId);
    const expectedDocument = previousDoc
      ? {
          content: previousDoc.content,
          sources: previousDoc.sources,
          updatedAt: previousDoc.updatedAt,
        }
      : null;
    retainedLore = !!expectedDocument?.content.trim();
    if (preserve && retainedLore) {
      await persistSetupLore(artistId, ownership, null, expectedDocument);
      preserved = true;
      wrote = true;
    } else {
      const sources = retainedLore
        ? await validateSetupLore(artistId, ownership, expectedDocument!)
        : await buildDocSources(artistId);
      if (!preserve && !sources.length) {
        yield {
          kind: "error",
          message:
            "About needs approved, readable Lore or artist-provided material. Add or review sources, then retry setup. Your saved text has been kept.",
        };
        return;
      }
      const { doc } = retainedLore
        ? { doc: expectedDocument!.content }
        : yield* yieldWhileRunning<TurnEvent, { doc: string }>(emit =>
            synthesizeArtistDoc(artistId, sources, {
              onTextDelta: delta =>
                emit({ kind: "text-delta", group: DOC_GROUP, call: "doc", delta }),
            }),
          );
      if (preserve) {
        await persistSetupLore(artistId, ownership, { content: doc, sources }, expectedDocument);
        preserved = true;
        wrote = true;
      } else {
        const about = yield* yieldWhileRunning<TurnEvent, string>(emit =>
          generateAboutFromDoc(artistName, doc, sources, {
            onTextDelta: delta =>
              emit({ kind: "text-delta", group: DOC_GROUP, call: "about", delta }),
          }),
        );
        const cleanAbout = stripCitationMarkers(about).trim();
        if (cleanAbout) {
          try {
            await persistArtistBio(artistId, cleanAbout, {
              generated: true,
              ownership,
              expectedBio: artist?.bio ?? null,
              expectedDocument,
              ...(retainedLore
                ? { expectedLore: { content: doc, sources } }
                : { document: { content: doc, sources }, documentOrigin: "server" as const }),
              confirmSteps: ["interview", "publish"],
            });
          } catch (error) {
            if (!(error instanceof BioConflictError)) throw error;
            await persistSetupLore(
              artistId,
              ownership,
              retainedLore ? null : { content: doc, sources },
              expectedDocument,
            );
            preserved = true;
          }
          wrote = true;
        }
      }
    }
  } catch (e) {
    console.error("[onboarding] auto-build About generation failed:", e);
    yield {
      kind: "error",
      message:
        e instanceof LoreChangedError
          ? "Your saved Lore needs review or an explicit refresh before setup can generate About. Your saved text has been kept. Review Lore, then retry setup."
          : e instanceof BioConflictError
            ? e.message
            : TURN_MESSAGES.autoBuildPublishFailed,
    };
    return;
  }
  yield {
    kind: "progress",
    label: preserved
      ? retainedLore
        ? "Kept your Lore and About"
        : "Prepared Lore; kept your About"
      : wrote
        ? "Wrote your About"
        : "Couldn't write an About yet",
    done: true,
    group: DOC_GROUP,
  };
  if (!wrote) {
    yield { kind: "error", message: TURN_MESSAGES.noAbout };
    return;
  }
  yield {
    kind: "chat",
    text: preserved
      ? retainedLore
        ? "Your existing Lore, About and any pin have been kept. New research sources are available for review and editing."
        : "Your research material is ready. Your existing About and any pin have been kept; you can edit them when ready."
      : citable > 0
        ? NARRATION.built
        : NARRATION.builtThin,
  };
  yield { kind: "complete" };
}
