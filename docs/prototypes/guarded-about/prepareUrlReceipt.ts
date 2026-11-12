import { createHash } from "node:crypto";
import { publicKnowledgeUrl } from "../../../lib/knowledge/publicKnowledgeUrl";

/** Prototype adapter: caller supplies the SAME transaction used to publish evidence. */
export type ReceiptTransaction = {
  query: <T>(sql: string, params: unknown[]) => Promise<{ rows: T[] }>;
};

/** Validate the exact original with the application policy; never store rejected URLs. */
export async function prepareUrlReceipt(tx: ReceiptTransaction, url: string): Promise<boolean> {
  // PostgreSQL UTF8 text cannot represent NUL or unpaired UTF16 surrogates.
  if (url.includes("\0") || Buffer.from(url, "utf8").toString("utf8") !== url) return false;
  if (publicKnowledgeUrl(url) === null) return false;
  const hash = createHash("sha256").update(url, "utf8").digest("hex");
  await tx.query(
    "insert into mn_private.public_url_receipts(url_hash,url,policy_version) values(decode($1,'hex'),$2,1) on conflict do nothing",
    [hash, url],
  );
  const { rows } = await tx.query<{ matches: boolean }>(
    "select convert_to(url,'UTF8')=convert_to($2::text,'UTF8') as matches from mn_private.public_url_receipts where url_hash=decode($1,'hex') and policy_version=1",
    [hash, url],
  );
  if (rows.length !== 1 || rows[0].matches !== true)
    throw new Error("URL receipt conflict: exact bytes were not persisted");
  return true;
}
