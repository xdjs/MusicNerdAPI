import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";
import type {
  ResearchAuth,
  ResearchCandidateRow,
  ResearchEvidenceRow,
} from "@/lib/questionResearch/types";
/** Reopen an immutable discovery revision with current curation/access checks and exact offsets. */
export async function readResearchEvidence(
  artistId: string,
  auth: ResearchAuth,
  evidenceId: string,
  revision: string,
  start: number,
  maxChars: number,
) {
  return db.transaction(
    async tx => {
      if (auth.kind === "artist") await authorizeArtistKnowledge(tx, artistId, auth.userId);
      const [row] = await tx.execute<ResearchCandidateRow & ResearchEvidenceRow>(
        sql`select c.*,e.id,e.revision,e.title,e.original_text,e.provenance from artist_research_evidence e join artist_research_candidates c on c.id=e.candidate_id and c.artist_id=e.artist_id where e.id=${evidenceId}::uuid and e.artist_id=${artistId}::uuid`,
      );
      if (
        !row ||
        (auth.kind === "service" &&
          (row.identity !== "confirmed" || !["pending", "approved"].includes(row.curation)))
      )
        throw new KnowledgeError("not_found", 404, "Original unavailable");
      if (row.revision !== revision)
        throw new KnowledgeError("revision_changed", 409, "Original revision unavailable");
      if (auth.kind === "service" && row.reviewed_revision && row.destination === "lore") {
        const eligible = await tx.execute(
          sql`select id from artist_vault_sources where id=${row.source_id}::uuid and artist_id=${artistId}::uuid and status='approved' and file_path is null`,
        );
        if (!eligible.length) throw new KnowledgeError("not_found", 404, "Original unavailable");
      }
      if (auth.kind === "service" && row.reviewed_revision && row.destination === "link") {
        const eligible = await tx.execute(
          sql`select id from artists a where id=${artistId}::uuid and to_jsonb(a)->>${row.platform}=${row.platform_id}`,
        );
        if (!eligible.length) throw new KnowledgeError("not_found", 404, "Original unavailable");
      }
      if (start > row.original_text.length)
        throw new KnowledgeError("invalid_request", 400, "Original offset is outside the text");
      const window = knowledgeWindow(row.original_text, start, maxChars);
      return {
        status: "ok" as const,
        passage: {
          sourceId: `discovery:${row.id}`,
          revision,
          ...window,
          url: row.url,
          curation:
            row.curation === "approved" && row.reviewed_revision === revision
              ? "approved"
              : "pending",
          evidenceKind: row.provenance.kind,
          speaker: row.provenance.speaker,
          publishedAt: row.provenance.publishedAt,
          retrievedAt: row.provenance.retrievedAt,
          truncated: row.provenance.truncated,
        },
        totalChars: row.original_text.length,
        nextStart: window.end < row.original_text.length ? window.end : null,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
