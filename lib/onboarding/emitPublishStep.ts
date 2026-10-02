import { getArtistById } from "@/lib/artists/getArtistById";
import { buildDocSources } from "@/lib/lore/buildDocSources";
import { extractCitedIds } from "@/lib/lore/extractCitedIds";
import { synthesizeArtistDoc } from "@/lib/lore/synthesizeArtistDoc";
import { synthesizeFallbackAbout } from "@/lib/lore/synthesizeFallbackAbout";
import { NARRATION, PUBLISH_RETRY_BUDGET_MS, TURN_MESSAGES } from "@/lib/onboarding/const";
import type { TurnEvent } from "@/lib/onboarding/types";

/**
 * Stage 1 of publishing: build the knowledge document and hand it over to be
 * read and corrected. The About comes after, from the version they approve.
 * One retry, skipped once past the retry budget so the turn fits its deadline,
 * then the plain fallback rather than a dead end.
 *
 * @param artistId - The artist.
 * @returns The step's events, ending in a `draft` at stage "doc".
 */
export async function* emitPublishStep(artistId: string): AsyncGenerator<TurnEvent> {
  yield { kind: "chat", text: NARRATION.generating };
  yield { kind: "progress", label: "Reading your sources and answers", done: false };
  const startedAt = Date.now();
  const sources = await buildDocSources(artistId);
  let doc: string | null = null;
  try {
    doc = (await synthesizeArtistDoc(artistId, sources)).doc;
  } catch (e) {
    if (Date.now() - startedAt > PUBLISH_RETRY_BUDGET_MS) throw e;
    yield { kind: "chat", text: TURN_MESSAGES.docRetry };
    try {
      doc = (await synthesizeArtistDoc(artistId, sources)).doc;
    } catch (e2) {
      console.error("[onboarding/publish] doc retry also failed, falling back:", e2);
    }
  }
  if (doc === null) {
    yield { kind: "chat", text: TURN_MESSAGES.simplerVersion };
    const artist = await getArtistById(artistId);
    const fallback = await synthesizeFallbackAbout(
      artistId,
      artist?.name ?? "this artist",
      undefined,
      sources,
    );
    doc = `## Overview\n${fallback}`;
  }
  yield { kind: "progress", label: "Reading your sources and answers", done: true };
  const cited = extractCitedIds(doc);
  yield { kind: "chat", text: NARRATION.docReady };
  yield {
    kind: "draft",
    stage: "doc",
    doc,
    about: null,
    sources: sources.filter(s => cited.has(s.id)),
  };
}
