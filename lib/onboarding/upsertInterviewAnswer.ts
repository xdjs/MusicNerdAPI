import { sql } from "drizzle-orm";
import { artistInterviewAnswers } from "@/lib/db/schema";
import type { InterviewAnswerSource } from "@/lib/onboarding/types";
import { withScopedArtistWrite } from "@/lib/ownership/withScopedArtistWrite";

/**
 * Records an interview answer (null = skipped). `createdAt` is answer
 * chronology; `offeredAt` and `sitting` are set by the first insert only, so a
 * retried submit can't move the sitting's material watermark.
 *
 * @param input - The answer.
 * @param input.artistId - The artist.
 * @param input.questionKey - The question's key, shared with MusicNerdWeb.
 * @param input.question - The question as asked.
 * @param input.answer - Their answer, or null when skipped.
 * @param input.sitting - The sitting, used only on insert.
 * @param input.source - Where the question came from.
 * @returns Nothing; a changed claim throws.
 */
export async function upsertInterviewAnswer(input: {
  artistId: string;
  questionKey: string;
  question: string;
  answer: string | null;
  sitting: number;
  source: InterviewAnswerSource;
}): Promise<void> {
  await withScopedArtistWrite(input.artistId, async tx => {
    await tx
      .insert(artistInterviewAnswers)
      .values(input)
      .onConflictDoUpdate({
        target: [artistInterviewAnswers.artistId, artistInterviewAnswers.questionKey],
        set: {
          question: input.question,
          answer: input.answer,
          source: input.source,
          createdAt: sql`(now() AT TIME ZONE 'utc'::text)`,
        },
      });
  });
}
