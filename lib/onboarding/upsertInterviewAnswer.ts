import { and, eq, sql } from "drizzle-orm";
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
    const saved = await tx
      .insert(artistInterviewAnswers)
      .values(input)
      .onConflictDoUpdate({
        target: [artistInterviewAnswers.artistId, artistInterviewAnswers.questionKey],
        setWhere: eq(artistInterviewAnswers.source, "offered"),
        set: {
          question: input.question,
          answer: input.answer,
          source: input.source,
          createdAt: sql`(now() AT TIME ZONE 'utc'::text)`,
        },
      })
      .returning({ id: artistInterviewAnswers.id });
    if (saved.length === 0) {
      const [existing] = await tx
        .select({ answer: artistInterviewAnswers.answer })
        .from(artistInterviewAnswers)
        .where(
          and(
            eq(artistInterviewAnswers.artistId, input.artistId),
            eq(artistInterviewAnswers.questionKey, input.questionKey),
          ),
        )
        .limit(1);
      if (!existing || existing.answer !== input.answer)
        throw new Error(
          "This question already has a saved response. Edit it from Questions in your profile.",
        );
    }
  });
}
