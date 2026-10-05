import { sql } from "drizzle-orm";
import { isIP } from "node:net";
import { db } from "@/lib/db/db";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import { lockScopedArtistWrite } from "@/lib/ownership/lockScopedArtistWrite";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { isPublicAddress } from "@/lib/sourceExtraction/isPublicAddress";
import { sourceExtractionSchemas } from "@/lib/sourceExtraction/sourceExtractionSchemas";

/** Queue missing originals under current ownership; reads never invoke this operation. */
export async function queueSourceExtraction(artistId: string, sourceIds: string[]) {
  const auth = getArtistOperationOwnership(artistId);
  if (!auth?.userId)
    throw new KnowledgeError("forbidden", 403, "Authenticated artist operation required");
  return db.transaction(async tx => {
    await lockScopedArtistWrite(tx, artistId);
    const rows = await tx.execute<{
      id: string;
      url: string;
      status: string;
      file_path: string | null;
      extracted_text: string | null;
    }>(
      sql`select id,url,status,file_path,extracted_text from artist_vault_sources where artist_id=${artistId}::uuid and id in (${sql.join(
        sourceIds.map(id => sql`${id}::uuid`),
        sql`,`,
      )}) for update`,
    );
    const invalid = () =>
      new KnowledgeError(
        "invalid_sources",
        400,
        "Select approved public URL sources belonging to this artist",
      );
    if (
      !sourceIds.length ||
      sourceIds.length > 20 ||
      rows.length !== sourceIds.length ||
      new Set(sourceIds).size !== sourceIds.length
    )
      throw invalid();
    for (const row of rows) {
      if (row.status !== "approved" || row.file_path) throw invalid();
      try {
        const u = new URL(row.url);
        const host = u.hostname.replace(/^\[|\]$/g, "");
        if (
          !["https:", "http:"].includes(u.protocol) ||
          u.username ||
          u.password ||
          u.port ||
          (isIP(host) && !isPublicAddress(host))
        )
          throw invalid();
      } catch {
        throw invalid();
      }
    }
    const sources = rows
      .filter(r => !r.extracted_text?.trim())
      .map(r => ({ id: r.id, url: r.url }));
    if (!sources.length) return { status: "ok" as const, jobId: null, queued: 0 };
    const live = await tx.execute(
      sql`select id from artist_research_jobs where artist_id=${artistId}::uuid and kind='source_extract' and status in ('pending','running') limit 1`,
    );
    if (live.length)
      throw new KnowledgeError("already_running", 409, "Source extraction is already running");
    const state = sourceExtractionSchemas.state.parse({
      version: 1,
      userId: auth.userId,
      expectedClaimId: auth.expectedClaimId,
      sources,
      outcomes: [],
    });
    const activityId = await recordArtistActivity(artistId, "source_extract", {}, tx);
    const [job] = await tx.execute<{ id: string }>(
      sql`insert into artist_research_jobs (artist_id,kind,total,state,activity_id) values (${artistId}::uuid,'source_extract',${sources.length},${JSON.stringify(state)}::jsonb,${activityId}::uuid) returning id`,
    );
    if (!job) throw new Error("Source job was not persisted");
    return { status: "ok" as const, jobId: job.id, queued: sources.length };
  });
}
