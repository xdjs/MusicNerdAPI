import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { artistInterviewAnswerVersions } from "@/lib/db/schema";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import type { TransactionDb } from "@/lib/ownership/types";
import { assertInterviewResponseBudget } from "./assertInterviewResponseBudget";
import { toInterviewResponse } from "./toInterviewResponse";
import type { ResponseRow, ResponseVersion } from "./types";

/** Validate archived identity and citation hashes before exposing any previous wording. */
export async function loadInterviewResponseVersions(
  tx: TransactionDb,
  current: ResponseRow,
): Promise<ResponseVersion[]> {
  const response = toInterviewResponse(current);
  await assertInterviewResponseBudget(tx, current.artistId, current.id);
  const rows = await tx
    .select()
    .from(artistInterviewAnswerVersions)
    .where(
      and(
        eq(artistInterviewAnswerVersions.artistId, current.artistId),
        eq(artistInterviewAnswerVersions.answerId, current.id),
      ),
    )
    .orderBy(
      desc(artistInterviewAnswerVersions.capturedAt),
      desc(artistInterviewAnswerVersions.revision),
    );
  const snapshotSchema = z
    .object({
      id: z.uuid(),
      artistId: z.uuid(),
      questionKey: z.string(),
      question: z.string(),
      answer: z.string(),
      source: z.string(),
      sitting: z.number().int().nullable(),
      offeredAt: z.string().nullable(),
      createdAt: z.string().nullable(),
    })
    .strict();
  const versions = rows.map(row => {
    const snapshot = snapshotSchema.safeParse(row.snapshot);
    if (
      !snapshot.success ||
      snapshot.data.id !== current.id ||
      snapshot.data.artistId !== current.artistId
    )
      throw new KnowledgeError(
        "storage_unavailable",
        503,
        "Stored response history is unavailable",
      );
    const retained = toInterviewResponse(snapshot.data);
    if (retained.revision !== row.revision)
      throw new KnowledgeError(
        "storage_unavailable",
        503,
        "Stored response history is unavailable",
      );
    return {
      response: retained,
      savedAt: retained.answerUpdatedAt,
      note: row.note,
      isCurrent: row.revision === response.revision,
    };
  });
  return [
    versions.find(v => v.isCurrent) ?? {
      response,
      savedAt: response.answerUpdatedAt,
      note: null,
      isCurrent: true,
    },
    ...versions
      .filter(v => !v.isCurrent)
      .sort(
        (a, b) =>
          (b.savedAt ?? "").localeCompare(a.savedAt ?? "") ||
          a.response.revision.localeCompare(b.response.revision),
      ),
  ];
}
