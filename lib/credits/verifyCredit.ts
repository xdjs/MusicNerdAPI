import { EMPTY_ROLES, FIRST_PERSON, MAX_ROLE_WORDS, SELF_WORDS } from "@/lib/credits/const";
import { containsQuote } from "@/lib/credits/containsQuote";
import { nameAppearsInCaption } from "@/lib/credits/nameAppearsInCaption";
import { roleIsSomebodyElsesHandle } from "@/lib/credits/roleIsSomebodyElsesHandle";
import type { CaptionCredit, RawCredit } from "@/lib/credits/types";
import { wordsOf } from "@/lib/credits/wordsOf";
import type { SocialPostRow } from "@/lib/instagram/types";
import { foldName } from "@/lib/text/foldName";
import { withoutAt } from "@/lib/artists/withoutAt";

/**
 * Checks one credit against the post it claims to come from. The cited url must
 * be one we sent, the quote must be in that caption, and the person must be in
 * that post. A claim failing any check is dropped, not repaired.
 *
 * @param c - The credit as the model returned it.
 * @param byUrl - The batch's posts by url.
 * @param artistName - The artist's name, to recognise self-credits.
 * @param artistHandle - The artist's handle, to recognise self-credits.
 * @returns The verified credit, or null.
 */
export function verifyCredit(
  c: RawCredit,
  byUrl: Map<string, SocialPostRow>,
  artistName: string,
  artistHandle: string,
): CaptionCredit | null {
  const url = typeof c.url === "string" ? c.url : "";
  const subject = typeof c.subject === "string" ? withoutAt(c.subject.trim()) : "";
  const role = typeof c.role === "string" ? c.role.trim() : "";
  // A role has to say something: a bare camera emoji is nothing as a label on an edge.
  if (!/\p{L}{2}/u.test(role)) return null;
  if (EMPTY_ROLES.has(role.toLowerCase().replace(/[^a-z]/g, ""))) return null;
  if (role.split(/\s+/).filter(Boolean).length > MAX_ROLE_WORDS) return null;
  if (FIRST_PERSON.test(role)) return null;
  const quote = typeof c.quote === "string" ? c.quote.trim() : "";
  if (!url || !subject || !quote) return null;

  const post = byUrl.get(url);
  if (!post) return null;
  const caption = post.caption ?? "";
  if (!containsQuote(caption, quote)) return null;

  const borrowed = roleIsSomebodyElsesHandle(role, subject, quote);
  if (borrowed) {
    console.log(
      `[socialCredits] Dropping "${role}" for ${subject} — that is @${borrowed}, not a job they did`,
    );
    return null;
  }

  // A handle counts when Instagram recorded it as a mention or it is written
  // with its @; a bare name only when written as whole words. A first-person
  // stand-in ("me") is exact by definition.
  const folded = foldName(subject);
  const inMentions = post.mentions.some(m => foldName(m) === folded);
  const isSelfWord = SELF_WORDS.has(folded);
  const inCaption =
    caption.toLowerCase().includes(`@${subject.toLowerCase()}`) ||
    nameAppearsInCaption(subject, caption) ||
    (isSelfWord && wordsOf(caption).includes(folded));
  if (!inMentions && !inCaption) return null;

  const selfKeys = new Set(
    [
      foldName(artistName),
      foldName(post.platform === "instagram" ? artistHandle : post.ownerUsername),
    ].filter(Boolean),
  );
  return {
    subject,
    // Only a handle if the model said so AND we can see the @ ourselves.
    // The current credit schema/UI links handle credits to Instagram. Other
    // platforms stay plain names with their original post evidence URL.
    isHandle:
      post.platform === "instagram" &&
      c.isHandle === true &&
      (inMentions || caption.includes(`@${subject}`)),
    role,
    quote,
    url,
    isSelf: selfKeys.has(folded) || isSelfWord,
  };
}
