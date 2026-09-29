import { MAX_BIO_LENGTH } from "@/lib/bio/const";
import { persistArtistBio } from "@/lib/bio/persistArtistBio";
import { ARTIST_DOC_MAX_CHARS } from "@/lib/lore/const";
import { stripCitationMarkers } from "@/lib/lore/stripCitationMarkers";
import { NARRATION, TURN_MESSAGES } from "@/lib/onboarding/const";
import { emitStep } from "@/lib/onboarding/emitStep";
import { guardTurnStep } from "@/lib/onboarding/guardTurnStep";
import { sanitizeDocSources } from "@/lib/onboarding/sanitizeDocSources";
import type { ClientTurn, TurnContext, TurnEvent } from "@/lib/onboarding/types";

/**
 * Publishes: the About (without citation markers) as the bio, the document
 * (with them) and its sources as the Lore, confirming the publish step in the
 * same transaction. The only implicit bio write in onboarding. Every echoed
 * field is checked; a draft without its starting-bio snapshot is refused.
 *
 * @param ctx - The turn's context.
 * @param turn - The turn, with the echoed document, About, sources and starting bio.
 * @returns The turn's events, ending in `complete`. A bio that changed meanwhile throws.
 */
export async function* handlePublishTurn(
  ctx: TurnContext,
  turn: Extract<ClientTurn, { type: "publish" }>,
): AsyncGenerator<TurnEvent> {
  const { artistId } = ctx;
  if (!(yield* guardTurnStep(ctx, "publish", TURN_MESSAGES.notYet))) return;
  const doc = turn.doc?.trim();
  const about = turn.about?.trim();
  if (!doc || doc.length > ARTIST_DOC_MAX_CHARS) {
    yield { kind: "error", message: TURN_MESSAGES.docOff };
    yield* emitStep(artistId, "publish");
    return;
  }
  if (!about || about.length > MAX_BIO_LENGTH) {
    yield { kind: "error", message: TURN_MESSAGES.aboutOff };
    yield* emitStep(artistId, "publish");
    return;
  }
  const sources = sanitizeDocSources(turn.sources);
  const cleanAbout = stripCitationMarkers(about);
  if (
    turn.expectedBio !== null &&
    (typeof turn.expectedBio !== "string" || turn.expectedBio.length > MAX_BIO_LENGTH)
  ) {
    yield { kind: "error", message: TURN_MESSAGES.missingStartingBio };
    return;
  }
  await persistArtistBio(artistId, cleanAbout, {
    generated: true,
    ownership: ctx.ownership,
    expectedBio: turn.expectedBio,
    document: { content: doc, sources },
    confirmSteps: ["publish"],
  });
  yield { kind: "chat", text: NARRATION.published };
  yield { kind: "complete" };
}
