import { sql } from "drizzle-orm";
import type { AuditLogEntry } from "@/lib/agentWork/types";
import { db } from "@/lib/db/db";

/**
 * A page of the MCP audit log, newest first, with the artist's name and the
 * writing key's label.
 *
 * @param page - The page, from 1; lower values read as 1.
 * @param limit - Entries per page, clamped to 1–200.
 * @returns The entries, the total count, and the page and limit used.
 */
export async function getAuditLog(
  page = 1,
  limit = 50,
): Promise<{
  entries: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}> {
  const effectivePage = Math.max(page, 1);
  const effectiveLimit = Math.min(Math.max(limit, 1), 200);
  const offset = (effectivePage - 1) * effectiveLimit;

  const [countResult, rows] = await Promise.all([
    db.execute<{ total: number }>(sql`
      SELECT COUNT(*)::int AS total FROM mcp_audit_log
    `),
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
    }>(sql`
      SELECT
        al.id, al.artist_id, a.name AS artist_name,
        al.field, al.action,
        al.old_value, al.new_value,
        k.label AS agent_label, al.created_at
      FROM mcp_audit_log al
      LEFT JOIN artists a ON a.id = al.artist_id
      LEFT JOIN mcp_api_keys k ON k.key_hash = al.api_key_hash
      ORDER BY al.created_at DESC
      LIMIT ${effectiveLimit} OFFSET ${offset}
    `),
  ]);

  return {
    entries: [...rows].map(row => ({
      id: row.id,
      artistId: row.artist_id,
      artistName: row.artist_name,
      field: row.field,
      action: row.action,
      oldValue: row.old_value,
      newValue: row.new_value,
      agentLabel: row.agent_label,
      createdAt: row.created_at,
    })),
    total: countResult[0]?.total ?? 0,
    page: effectivePage,
    limit: effectiveLimit,
  };
}
