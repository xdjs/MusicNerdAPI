import { getArtistById } from "@/lib/artists/getArtistById";
import { ARTIST_DOC_MAX_CHARS } from "@/lib/lore/const";
import { extractCitedIds } from "@/lib/lore/extractCitedIds";
import { generateAboutFromDoc } from "@/lib/lore/generateAboutFromDoc";
import { synthesizeFallbackAbout } from "@/lib/lore/synthesizeFallbackAbout";
import { NARRATION, PUBLISH_RETRY_BUDGET_MS, TURN_MESSAGES } from "@/lib/onboarding/const";
import { emitStep } from "@/lib/onboarding/emitStep";
import { guardTurnStep } from "@/lib/onboarding/guardTurnStep";
import { sanitizeDocSources } from "@/lib/onboarding/sanitizeDocSources";
import type { ClientTurn, TurnContext, TurnEvent } from "@/lib/onboarding/types";

/**
 * Stage 2 of publishing: the artist has read the document and chooses how the
 * About is written, from the version they approved (it may carry their
 * corrections). The starting bio is captured now and round-trips to publish,
 * so an old draft can't overwrite a newer edit from another tab.
 *
 * @param ctx - The turn's context.
 * @param turn - The turn, with the mode and the echoed document and sources.
 * @returns The turn's events, ending in a `draft` at stage "about".
 */
export async function* handleAboutChoiceTurn(
  ctx: TurnContext,
  turn: Extract<ClientTurn, { type: "about_choice" }>,
): AsyncGenerator<TurnEvent> {
  const { artistId } = ctx;
  if (!(yield* guardTurnStep(ctx, "publish", TURN_MESSAGES.notYet))) return;
  const doc = turn.doc?.trim();
  if (!doc || doc.length > ARTIST_DOC_MAX_CHARS) {
    yield { kind: "error", message: TURN_MESSAGES.docOff };
    yield* emitStep(artistId, "publish");
    return;
  }
  const sources = sanitizeDocSources(turn.sources);
  const artist = await getArtistById(artistId);
  const expectedBio = artist?.bio ?? null;
  if (turn.mode === "self") {
    // Their words are the point: no draft put in their mouth first.
    yield { kind: "chat", text: NARRATION.selfWrite };
    yield { kind: "draft", stage: "about", doc, about: "", sources, selfWrite: true, expectedBio };
    return;
  }

  yield { kind: "chat", text: NARRATION.writingAbout };
  yield { kind: "progress", label: "Writing your About", done: false };
  const startedAt = Date.now();
  const artistName = artist?.name ?? "this artist";
  let about: string | null = null;
  try {
    about = await generateAboutFromDoc(artistName, doc, sources);
  } catch (e) {
    if (Date.now() - startedAt > PUBLISH_RETRY_BUDGET_MS) throw e;
    yield { kind: "chat", text: TURN_MESSAGES.aboutRetry };
    try {
      about = await generateAboutFromDoc(artistName, doc, sources);
    } catch (e2) {
      console.error("[onboarding/about_choice] about retry also failed, falling back:", e2);
    }
  }
  if (about === null) {
    yield { kind: "chat", text: TURN_MESSAGES.simplerVersion };
    about = await synthesizeFallbackAbout(artistId, artistName, doc, sources);
  }
  yield { kind: "progress", label: "Writing your About", done: true };
  const citedIds = new Set([...extractCitedIds(doc), ...extractCitedIds(about)]);
  yield { kind: "chat", text: NARRATION.draftReady };
  yield {
    kind: "draft",
    stage: "about",
    doc,
    about,
    sources: sources.filter(s => citedIds.has(s.id)),
    expectedBio,
  };
}
