import { containsQuote } from "@/lib/credits/containsQuote";
import type { ArtistStatement, RawStatement } from "@/lib/credits/types";
import type { SocialPostRow } from "@/lib/instagram/types";

/**
 * Checks one statement: a post we sent, a topic, and a quote that is in that caption.
 *
 * @param s - The statement as the model returned it.
 * @param byUrl - The batch's posts by url.
 * @returns The verified statement, or null.
 */
export function verifyStatement(
  s: RawStatement,
  byUrl: Map<string, SocialPostRow>,
): ArtistStatement | null {
  const url = typeof s.url === "string" ? s.url : "";
  const quote = typeof s.quote === "string" ? s.quote.trim() : "";
  const topic = typeof s.topic === "string" ? s.topic.trim() : "";
  if (!url || !quote || !topic) return null;
  const post = byUrl.get(url);
  if (!post || !containsQuote(post.caption ?? "", quote)) return null;
  return { quote, topic, url };
}
