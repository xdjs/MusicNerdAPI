import type { ArtistStatement, CaptionCredit, CaptionExtraction } from "@/lib/credits/types";
import { TOP_SAME_POST } from "@/lib/questions/const";
import { shortCodeFromUrl } from "@/lib/questions/shortCodeFromUrl";
import type { SignalCandidate } from "@/lib/questions/types";

/**
 * A credit and a statement the artist put in the same post: connected because
 * they said them together. Only posts with exactly one credit, since a roundup
 * naming nine people would pair two things at random. The material states the
 * join and nothing more.
 *
 * @param artistName - The artist.
 * @param extraction - The artist's stored caption credits.
 * @returns Up to TOP_SAME_POST candidates, each citing only its post.
 */
export function samePostCandidates(
  artistName: string,
  extraction: CaptionExtraction,
): SignalCandidate[] {
  const byPost = new Map<string, { credits: CaptionCredit[]; statements: ArtistStatement[] }>();
  for (const c of extraction.credits) {
    if (c.isSelf || !c.url) continue;
    const at = byPost.get(c.url) ?? { credits: [], statements: [] };
    at.credits.push(c);
    byPost.set(c.url, at);
  }
  for (const st of extraction.statements) {
    if (!st.url) continue;
    const at = byPost.get(st.url) ?? { credits: [], statements: [] };
    at.statements.push(st);
    byPost.set(st.url, at);
  }
  return [...byPost.entries()]
    .filter(([, v]) => v.credits.length === 1 && v.statements.length > 0)
    .slice(0, TOP_SAME_POST)
    .map(([url, v]) => {
      const credit = v.credits[0];
      const statement = v.statements[0];
      const subject = credit.isHandle ? `@${credit.subject}` : credit.subject;
      return {
        signalId: `same_post_${shortCodeFromUrl(url)}`,
        kind: "same_post",
        key: `social_same_post_${shortCodeFromUrl(url)}`,
        authoredBy: "artist",
        material: `IN ONE POST, ${artistName} credited ${subject} as "${credit.role}" and also wrote, about ${statement.topic}: "${statement.quote}". The only thing this establishes is that they said both in the same post. It does NOT establish that ${subject} worked on whatever the writing is about — ask about that rather than asserting it.`,
        sourceUrls: [url],
      };
    });
}
