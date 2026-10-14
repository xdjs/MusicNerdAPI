import { sql } from "drizzle-orm";
import type { ScopedWriteDb } from "@/lib/ownership/types";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";

/** Inside the source insertion transaction, persist identity assessment for its unchanged pending original. */
export async function recordSourceAssessment(
  writer: Pick<ScopedWriteDb, "execute">,
  artistId: string,
  sourceId: string,
  expected: { text: string; url: string; updatedAt: string | null },
): Promise<void> {
  const scope = getArtistOperationOwnership(artistId);
  if (scope?.trigger !== "directory_add" || !scope.activityId) return;
  await writer.execute(sql`
      insert into artist_source_assessments(source_id,artist_id,activity_id,snapshot)
      select v.id,v.artist_id,${scope.activityId}::uuid,public.knowledge_vault_source_snapshot(v)
      from artist_vault_sources v where v.id=${sourceId}::uuid and v.artist_id=${artistId}::uuid
        and v.status='pending' and v.file_path is null and v.origin='research'
        and v.activity_id=${scope.activityId}::uuid and v.extracted_text=${expected.text} and v.url=${expected.url}
        and v.updated_at is not distinct from ${expected.updatedAt}::timestamptz
      on conflict(source_id) do update set snapshot=excluded.snapshot, assessed_at=now()
    `);
}
