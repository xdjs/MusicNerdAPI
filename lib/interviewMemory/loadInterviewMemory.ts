import { db } from "@/lib/db/db";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { readInterviewMemorySnapshot } from "./readInterviewMemorySnapshot";
/** Mandatory memory has one repeatable-read snapshot; writes reuse the same reader under the artist lock. */
export async function loadInterviewMemory(artistId: string, userId: string, sitting: number) {
  if (!Number.isInteger(sitting) || sitting < 1 || sitting > 2147483647)
    throw new KnowledgeError("invalid_input", 400, "Invalid interview sitting");
  return db.transaction(tx => readInterviewMemorySnapshot(tx, artistId, userId, sitting), {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
}
