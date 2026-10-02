import type { SocialPostRow } from "@/lib/instagram/types";
import { bumpTheme } from "@/lib/socialSignals/bumpTheme";
import {
  CAPTION_STOPWORDS,
  MAX_THEME_TERM_LEN,
  MIN_PHRASE_WORD_LEN,
  MIN_THEME_COUNT,
  MIN_THEME_COUNT_GENERIC_WORD,
} from "@/lib/socialSignals/const";
import { isProperNounStyle } from "@/lib/socialSignals/isProperNounStyle";
import type { Theme, ThemeTally } from "@/lib/socialSignals/types";

/**
 * Recurring hashtags, salient caption words and repeated two-word phrases,
 * from the artist's own posts only. A plain word is trusted as a theme when it
 * clears a high bar on its own, or the normal bar with proper-noun evidence
 * (seen capitalized mid-caption). Hashtags and phrases are deliberate enough to
 * keep the low bar. That keeps "black church" and a place name over "myself".
 *
 * @param posts - The posts to read.
 * @param artistNameTokens - Words of the artist's own name, never a theme.
 * @returns Themes, most posts first, then by term.
 */
export function deriveThemes(posts: SocialPostRow[], artistNameTokens: Set<string>): Theme[] {
  const own = posts.filter(p => p.isOwnPost);
  const tally: ThemeTally = new Map();
  // Capitalized somewhere other than the first word: usually a proper noun.
  const capitalizedEvidence = new Set<string>();

  for (const post of own) {
    for (const tag of post.hashtags) {
      const term = tag.trim().toLowerCase();
      if (term && !artistNameTokens.has(term)) bumpTheme(tally, term, "hashtag", post.url);
    }
    if (!post.caption) continue;

    const rawTokens = post.caption.match(/[A-Za-z']{4,}/g) ?? [];
    rawTokens.forEach((token, i) => {
      if (i > 0 && isProperNounStyle(token)) capitalizedEvidence.add(token.toLowerCase());
    });
    const words = rawTokens.map(t => t.toLowerCase());

    const seenInThisPost = new Set<string>();
    for (const word of words) {
      if (
        word.length > MAX_THEME_TERM_LEN ||
        CAPTION_STOPWORDS.has(word) ||
        seenInThisPost.has(word)
      )
        continue;
      if (artistNameTokens.has(word)) continue;
      seenInThisPost.add(word);
      bumpTheme(tally, word, "caption_term", post.url);
    }

    // Adjacent pairs from the caption: a phrase repeating verbatim is stronger
    // evidence of a real theme than any one word in it.
    const seenPhrasesInThisPost = new Set<string>();
    for (let i = 0; i < words.length - 1; i++) {
      const w1 = words[i];
      const w2 = words[i + 1];
      if (w1.length < MIN_PHRASE_WORD_LEN || w2.length < MIN_PHRASE_WORD_LEN) continue;
      if (CAPTION_STOPWORDS.has(w1) || CAPTION_STOPWORDS.has(w2)) continue;
      if (artistNameTokens.has(w1) || artistNameTokens.has(w2)) continue;
      const phrase = `${w1} ${w2}`;
      if (phrase.length > MAX_THEME_TERM_LEN || seenPhrasesInThisPost.has(phrase)) continue;
      seenPhrasesInThisPost.add(phrase);
      bumpTheme(tally, phrase, "caption_phrase", post.url);
    }
  }

  return [...tally.entries()]
    .map(([key, v]) => ({ term: key.slice(v.kind.length + 1), ...v }))
    .filter(t => {
      if (t.kind !== "caption_term") return t.count >= MIN_THEME_COUNT;
      if (t.count >= MIN_THEME_COUNT_GENERIC_WORD) return true;
      return t.count >= MIN_THEME_COUNT && capitalizedEvidence.has(t.term);
    })
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
}
