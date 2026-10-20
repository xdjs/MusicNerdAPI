import { sql } from "drizzle-orm";
import type { TransactionDb } from "@/lib/ownership/types";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";

/** Reads a consumed request receipt. Missing jobs never authorize a second execution. */
export async function readEditorSourceSearch(
  tx: TransactionDb,
  artistId: string,
  userId: string,
  requestId: string,
) {
  const [receipt] = await tx.execute<{
    artist_id: string;
    actor_user_id: string | null;
    actor_kind: string;
    action: string;
    trigger: string;
  }>(
    sql`select artist_id,actor_user_id,actor_kind,action,trigger from artist_activity_events where id=${requestId}::uuid`,
  );
  if (!receipt) return null;
  if (
    receipt.artist_id !== artistId ||
    receipt.actor_user_id !== userId ||
    receipt.actor_kind !== "user" ||
    receipt.action !== "source_search" ||
    receipt.trigger !== "editor_search"
  )
    throw new KnowledgeError("request_conflict", 409, "Request identifier is already in use");
  const [job] = await tx.execute<{ id: string; status: string; state: Record<string, unknown> }>(
    sql`select id,status,state from artist_research_jobs where id=${requestId}::uuid and artist_id=${artistId}::uuid and activity_id=${requestId}::uuid and kind='source_search'`,
  );
  const [sources] = await tx.execute<{ count: number }>(
    sql`select count(*)::int as count from artist_vault_sources where artist_id=${artistId}::uuid and activity_id=${requestId}::uuid`,
  );
  const phase = !job
    ? "interrupted"
    : job.state.phase === "interrupted"
      ? "interrupted"
      : job.status;
  return { status: "ok" as const, requestId, jobId: requestId, phase, count: sources?.count ?? 0 };
}
