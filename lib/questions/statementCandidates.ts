import type { ArtistStatement } from "@/lib/credits/types";
import { TOP_STATEMENTS } from "@/lib/questions/const";
import { rankStatements } from "@/lib/questions/rankStatements";
import { shortCodeFromUrl } from "@/lib/questions/shortCodeFromUrl";
import { slug } from "@/lib/questions/slug";
import type { SignalCandidate } from "@/lib/questions/types";

/**
 * What the artist said about their own work: the material is the quote, so a
 * question can answer what they actually wrote.
 *
 * @param artistName - The artist.
 * @param statements - The artist's stored statements.
 * @returns The best TOP_STATEMENTS, keyed by post and topic.
 */
export function statementCandidates(
  artistName: string,
  statements: ArtistStatement[],
): SignalCandidate[] {
  return rankStatements(statements)
    .slice(0, TOP_STATEMENTS)
    .map(s => {
      const id = `${shortCodeFromUrl(s.url)}_${slug(s.topic)}`;
      return {
        signalId: `statement_${id}`,
        kind: "statement",
        key: `social_statement_${id}`,
        authoredBy: "artist",
        material: `${artistName} wrote, about ${s.topic}: "${s.quote}"`,
        sourceUrls: [s.url],
      };
    });
}
