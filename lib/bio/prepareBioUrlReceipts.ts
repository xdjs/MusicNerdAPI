import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { rowsOf } from "@/lib/db/rowsOf";
import { publicKnowledgeUrl } from "@/lib/knowledge/publicKnowledgeUrl";
import type { TransactionDb } from "@/lib/ownership/types";

/** Prepare URL-policy receipts on the caller's publication transaction, never on a read. */
export async function prepareBioUrlReceipts(
  tx: Pick<TransactionDb, "execute">,
  provenance: unknown,
): Promise<void> {
  if (
    !provenance ||
    typeof provenance !== "object" ||
    !("version" in provenance) ||
    provenance.version !== 1 ||
    !("kind" in provenance) ||
    typeof provenance.kind !== "string" ||
    !["generated", "authored"].includes(provenance.kind) ||
    !("sources" in provenance) ||
    !Array.isArray(provenance.sources)
  )
    return;
  const urls = new Set<string>();
  for (const source of provenance.sources) {
    if (!source || typeof source !== "object" || typeof source.url !== "string") continue;
    const url = source.url;
    // Existing historical policy-invalid lineage may still be edited; it stays publicly hidden.
    if (
      url.includes("\0") ||
      Buffer.from(url, "utf8").toString("utf8") !== url ||
      publicKnowledgeUrl(url) === null
    )
      continue;
    urls.add(url);
  }
  try {
    for (const url of [...urls].sort()) {
      const hash = createHash("sha256").update(url, "utf8").digest("hex");
      await tx.execute(sql`insert into mn_private.public_url_receipts(url_hash,url,policy_version)
      values(decode(${hash},'hex'),${url},1) on conflict do nothing`);
      const rows = rowsOf(
        await tx.execute(sql`select convert_to(url,'UTF8')=convert_to(${url}::text,'UTF8') as matches
      from mn_private.public_url_receipts where url_hash=decode(${hash},'hex') and policy_version=1`),
      ) as { matches: boolean }[];
      if (rows.length !== 1 || rows[0].matches !== true)
        throw new Error("URL receipt conflict: exact bytes were not persisted");
    }
  } catch (error) {
    // Drizzle errors carry bound URL values; do not expose historical source URLs to caller logs.
    if (
      error instanceof Error &&
      error.message === "URL receipt conflict: exact bytes were not persisted"
    )
      throw new Error("URL receipt conflict: exact bytes were not persisted");
    throw new Error("Could not prepare About URL receipts");
  }
}
