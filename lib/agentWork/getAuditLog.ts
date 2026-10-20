import { sql } from "drizzle-orm";
import type { AgentWorkDetails } from "@/lib/agentWork/types";
import { db } from "@/lib/db/db";

/**
 * A page of the MCP audit log, newest first, with artist names and agent labels.
 *
 * @param page - 1-based page; values below 1 read page 1.
 * @param limit - Rows per page, clamped to 1–200.
 * @returns The entries, the total row count and the page actually read.
 */
export async function getAuditLog(page = 1, limit = 50): Promise<AgentWorkDetails["auditLog"]> {
  const effectivePage = Math.max(page, 1);
  const effectiveLimit = Math.min(Math.max(limit, 1), 200);
  const offset = (effectivePage - 1) * effectiveLimit;
  const [countRows, rows] = await Promise.all([
    db.execute<{ total: number }>(sql`select count(*)::int as total from mcp_audit_log`),
    db.execute<{
      id: string;
      artist_id: string;
      artist_name: string | null;
      field: string;
      action: string;
      old_value: string | null;
      new_value: string | null;
      agent_label: string | null;
      created_at: string;
    }>(sql`select al.id, al.artist_id, a.name as artist_name, al.field, al.action,
        al.old_value, al.new_value, k.label as agent_label, al.created_at
      from mcp_audit_log al
      left join artists a on a.id = al.artist_id
      left join mcp_api_keys k on k.key_hash = al.api_key_hash
      order by al.created_at desc limit ${effectiveLimit} offset ${offset}`),
  ]);
  return {
    entries: [...rows].map(r => ({
      id: r.id,
      artistId: r.artist_id,
      artistName: r.artist_name,
      field: r.field,
      action: r.action,
      oldValue: r.old_value,
      newValue: r.new_value,
      agentLabel: r.agent_label,
      createdAt: r.created_at,
    })),
    total: countRows[0]?.total ?? 0,
    page: effectivePage,
    limit: effectiveLimit,
  };
}
