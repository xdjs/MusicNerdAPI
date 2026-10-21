import { db } from "@/lib/db/db";
import { mcpAuditLog } from "@/lib/db/schema";
import type { AuditEntry } from "@/lib/mcp/types";

/**
 * Appends what a write tool changed to `mcp_audit_log`, with the key's hash.
 * The log is append-only. Callers treat a failure here as best-effort: the
 * mutation already succeeded.
 *
 * @param entryOrEntries - One entry, or a batch written in one insert.
 * @returns Once the rows are written; nothing for an empty batch.
 */
export async function logMcpAudit(entryOrEntries: AuditEntry | AuditEntry[]): Promise<void> {
  const entries = Array.isArray(entryOrEntries) ? entryOrEntries : [entryOrEntries];
  if (entries.length === 0) return;
  await db.insert(mcpAuditLog).values(
    entries.map(entry => ({
      artistId: entry.artistId,
      field: entry.field,
      action: entry.action,
      submittedUrl: entry.submittedUrl ?? null,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      apiKeyHash: entry.apiKeyHash,
    })),
  );
}
