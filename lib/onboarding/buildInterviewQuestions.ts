import { waitForSocialPosts } from "@/lib/instagram/waitForSocialPosts";
import {
  INTERVIEW_QUESTION_CAP,
  ONBOARDING_QUESTIONS,
  SOCIAL_INGEST_WAIT_MS,
} from "@/lib/onboarding/const";
import type { InterviewQuestionCandidate } from "@/lib/onboarding/types";
import { generateGroundedQuestions } from "@/lib/questions/generateGroundedQuestions";

/**
 * The interview's questions: grounded ones (from the artist's own posts)
 * first, the static bank filling the rest, at most three. The interview must
 * never break because Apify or Gemini had a bad day, so any failure falls
 * back to the static questions.
 *
 * @param artistId - The artist.
 * @returns Up to three questions.
 */
export async function buildInterviewQuestions(
  artistId: string,
): Promise<InterviewQuestionCandidate[]> {
  let grounded: InterviewQuestionCandidate[] = [];
  try {
    // The scrape queued at the profiles step may still be landing: a bounded top-up.
    const havePosts = await waitForSocialPosts(artistId, SOCIAL_INGEST_WAIT_MS);
    if (!havePosts) {
      console.warn(
        `[onboarding] no social posts for ${artistId} — interview falls back to static questions`,
      );
    }
    grounded = (await generateGroundedQuestions(artistId, { max: INTERVIEW_QUESTION_CAP })).map(
      g => ({ key: g.key, question: g.question, sourceUrls: g.sourceUrls }),
    );
    if (havePosts && grounded.length === 0) {
      console.warn(
        `[onboarding] posts exist for ${artistId} but no grounded questions cleared the bar`,
      );
    }
  } catch (e) {
    console.error("[onboarding] generateGroundedQuestions failed:", e);
  }
  const groundedKeys = new Set(grounded.map(g => g.key));
  const staticQuestions = ONBOARDING_QUESTIONS.filter(q => !groundedKeys.has(q.key)).map(q => ({
    key: q.key as string,
    question: q.question as string,
    sourceUrls: [],
  }));
  return [...grounded, ...staticQuestions].slice(0, INTERVIEW_QUESTION_CAP);
}
