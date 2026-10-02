import { TOP_THEMES } from "@/lib/questions/const";
import { slug } from "@/lib/questions/slug";
import type { SignalCandidate } from "@/lib/questions/types";
import type { Theme } from "@/lib/socialSignals/types";

/**
 * Recurring terms from the artist's own captions. A term can surface as both a
 * hashtag and a caption word, so themes are deduped by term first (the hashtag
 * wins a tie, being the more deliberate), so the same word isn't asked twice.
 *
 * @param artistName - The artist.
 * @param themes - The themes derived from the posts.
 * @returns The TOP_THEMES with the highest count.
 */
export function themeCandidates(artistName: string, themes: Theme[]): SignalCandidate[] {
  const byTerm = new Map<string, Theme>();
  for (const t of themes) {
    const termKey = slug(t.term);
    const existing = byTerm.get(termKey);
    if (
      !existing ||
      t.count > existing.count ||
      (t.count === existing.count && t.kind === "hashtag")
    ) {
      byTerm.set(termKey, t);
    }
  }
  return [...byTerm.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_THEMES)
    .map(t => {
      const termNoun =
        t.kind === "hashtag" ? "hashtag" : t.kind === "caption_phrase" ? "phrase" : "word";
      return {
        signalId: `theme_${t.kind}_${slug(t.term)}`,
        kind: "theme",
        key: `social_theme_${t.kind}_${slug(t.term)}`,
        authoredBy: "artist",
        material: `${artistName} recurringly uses the ${termNoun} "${t.term}" in their own Instagram captions (appears in ${t.count} of their own posts).`,
        sourceUrls: t.evidenceUrls,
      };
    });
}
