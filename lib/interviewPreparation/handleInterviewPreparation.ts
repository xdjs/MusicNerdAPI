import { z } from "zod";
import { db } from "@/lib/db/db";
import { withInterviewMemoryRequest } from "@/lib/interviewMemory/withInterviewMemoryRequest";
import { readInterviewSessionBody } from "@/lib/interviewSessions/readInterviewSessionBody";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { queueInterviewPreparationInTransaction } from "./queueInterviewPreparationInTransaction";
import { consumeInterviewPreparation } from "./consumeInterviewPreparation";
import { getInterviewPreparation } from "./getInterviewPreparation";
/** Private preparation commands; reads never queue or consume. */
export async function handleInterviewPreparation(
  request: Request,
  artistId: string,
  sessionId: string,
) {
  return withInterviewMemoryRequest(request, artistId, async userId => {
    if (!z.uuid().safeParse(sessionId).success || new URL(request.url).search)
      throw new KnowledgeError("invalid_input", 400, "Invalid preparation request");
    if (request.method === "GET") return getInterviewPreparation(artistId, userId, sessionId);
    const parsed = z
      .strictObject({ action: z.enum(["prepare", "consume"]) })
      .safeParse(await readInterviewSessionBody(request));
    if (!parsed.success)
      throw new KnowledgeError("invalid_input", 400, "Invalid preparation action");
    if (parsed.data.action === "consume")
      return consumeInterviewPreparation(artistId, userId, sessionId);
    return db.transaction(tx =>
      queueInterviewPreparationInTransaction(tx, artistId, userId, sessionId),
    );
  });
}
