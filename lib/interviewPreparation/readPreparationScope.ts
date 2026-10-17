import { authorizeInterviewPreparation } from "./authorizeInterviewPreparation";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { readInterviewSessionState } from "@/lib/interviewSessions/readInterviewSessionState";
import { readInterviewMemorySnapshot } from "@/lib/interviewMemory/readInterviewMemorySnapshot";
import { pageInterviewMemory } from "@/lib/interviewMemory/pageInterviewMemory";
import type { TransactionDb } from "@/lib/ownership/types";
/** Bind preparation to the exact active sitting, next ordinal and current mandatory memory. */
export async function readPreparationScope(
  tx: TransactionDb,
  artistId: string,
  userId: string,
  sessionId: string,
) {
  const claimId = await authorizeInterviewPreparation(tx, artistId, userId);
  const { session } = await readInterviewSessionState(tx, artistId, sessionId);
  if (!session || session.state !== "active")
    throw new KnowledgeError("preparation_stale", 409, "This interview has finished.");
  const memory = await readInterviewMemorySnapshot(tx, artistId, userId, session.sitting);
  return {
    session,
    claimId,
    userId,
    sessionId,
    sitting: session.sitting,
    ordinal: session.questions.length + 1,
    memorySnapshotId: pageInterviewMemory(memory, { maxChars: 12000 }).snapshotId,
  };
}
