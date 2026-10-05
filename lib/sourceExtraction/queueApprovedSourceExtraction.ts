import { sql } from "drizzle-orm";
import type { db } from "@/lib/db/db";
import { isIP } from "node:net";
import { isPublicAddress } from "@/lib/sourceExtraction/isPublicAddress";

/** Queue one approved missing original inside its authorized source mutation. The caller holds the artist lock. */
export async function queueApprovedSourceExtraction(
  writer: Pick<typeof db, "execute">,
  source: {
    id: string;
    artistId: string;
    url: string;
    status: string;
    filePath?: string | null;
    extractedText?: string | null;
  },
  activityId: string | null,
): Promise<void> {
  if (
    source.status !== "approved" ||
    source.filePath ||
    source.extractedText?.trim() ||
    source.url.length > 8192
  )
    return;
  try {
    const url = new URL(source.url);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      (isIP(host) && !isPublicAddress(host))
    )
      return;
  } catch {
    return;
  }
  try {
    const [claim] = await writer.execute<{ id: string }>(
      sql`select id from artist_claims where artist_id=${source.artistId}::uuid and status='approved' limit 1`,
    );
    const expectedClaimId = claim?.id ?? null;
    await writer.execute(
      sql`update artist_research_jobs set status='done',claimed_at=null,last_error='Cancelled after ownership changed',updated_at=now() where artist_id=${source.artistId}::uuid and kind='source_extract' and status in ('queued','pending','running') and state->>'version'='2' and state->>'autoSourceId'=${source.id} and state->>'expectedClaimId' is distinct from ${expectedClaimId}`,
    );
    const state = {
      version: 2,
      autoSourceId: source.id,
      expectedClaimId,
      sources: [{ id: source.id, url: source.url }],
      outcomes: [],
    };
    await writer.execute(
      sql`insert into artist_research_jobs (artist_id,kind,status,total,state,activity_id) values (${source.artistId}::uuid,'source_extract','queued',1,${JSON.stringify(state)}::jsonb,${activityId}::uuid) on conflict do nothing`,
    );
  } catch {
    throw new Error("Source extraction queue unavailable");
  }
}
