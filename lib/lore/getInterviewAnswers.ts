import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistInterviewAnswers } from "@/lib/db/schema";
import type { InterviewAnswerRow } from "@/lib/lore/types";

/**
 * The artist's interview answers, oldest first. A null answer was skipped.
 *
 * @param artistId - The artist.
 * @returns The answers, or null on a database error.
 */
export async function getInterviewAnswers(artistId: string): Promise<InterviewAnswerRow[] | null> {
  try {
    return await db.query.artistInterviewAnswers.findMany({
      where: eq(artistInterviewAnswers.artistId, artistId),
      orderBy: [asc(artistInterviewAnswers.createdAt)],
    });
  } catch (e) {
    console.error("[getInterviewAnswers] Error:", e);
    return null;
  }
}
