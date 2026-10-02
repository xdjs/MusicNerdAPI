import type { CaptionCredit, CaptionExtraction } from "@/lib/credits/types";

/**
 * A caption credit for tests.
 *
 * @param subject - Who was credited.
 * @param url - The post.
 * @param role - The role, in the artist's words.
 * @param quote - The sentence it came from.
 * @returns A full CaptionCredit.
 */
export function credit(
  subject: string,
  url: string,
  role = "Mixed by",
  quote = `${role} @${subject}`,
): CaptionCredit {
  return { subject, isHandle: true, isSelf: false, role, quote, url, postedAt: null };
}

/** A collaborator credited on two posts, plus a statement sharing one of them. */
export const EXTRACTION: CaptionExtraction = {
  credits: [
    credit("p3t3rango", "https://www.instagram.com/p/A/", "Mixed by", "Mixed by @p3t3rango"),
    credit(
      "p3t3rango",
      "https://www.instagram.com/p/B/",
      "engineered by",
      "engineered by @p3t3rango",
    ),
  ],
  statements: [
    {
      quote: "my first single engineered by someone other than myself",
      topic: "a first",
      url: "https://www.instagram.com/p/B/",
      postedAt: null,
    },
    {
      quote: "a silhouette in flickering light",
      topic: "what Hourglass means",
      url: "https://www.instagram.com/p/Z/",
      postedAt: null,
    },
  ],
};
