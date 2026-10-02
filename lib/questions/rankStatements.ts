import type { ArtistStatement } from "@/lib/credits/types";
import { MAX_STATEMENTS_PER_POST } from "@/lib/questions/const";
import { isRecutOf } from "@/lib/questions/isRecutOf";
import { statementScore } from "@/lib/questions/statementScore";

/**
 * Which of an artist's statements are worth asking about, best first. Dedupes
 * re-cut quotes and caps each caption, then ranks statements that name
 * somebody or say something substantial first, newest breaking a tie. Recency
 * alone was rejected: it clusters on one event.
 *
 * @param statements - The artist's stored statements.
 * @returns The deduped statements, ranked.
 */
export function rankStatements(statements: ArtistStatement[]): ArtistStatement[] {
  const seenQuote: string[] = [];
  const perPost = new Map<string, number>();
  const deduped: ArtistStatement[] = [];
  for (const s of statements) {
    const key = (s.quote ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || seenQuote.some(k => k === key || isRecutOf(k, key))) continue;
    const used = perPost.get(s.url) ?? 0;
    if (used >= MAX_STATEMENTS_PER_POST) continue;
    seenQuote.push(key);
    perPost.set(s.url, used + 1);
    deduped.push(s);
  }
  return [...deduped].sort(
    (a, b) =>
      statementScore(b) - statementScore(a) ||
      String(b.postedAt ?? "").localeCompare(String(a.postedAt ?? "")),
  );
}
