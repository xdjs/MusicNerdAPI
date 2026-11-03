import { publicKnowledgeUrl } from "@/lib/knowledge/publicKnowledgeUrl";
import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/db";
import { artistVaultSources } from "@/lib/db/schema";
import { publicVaultSourceSql } from "@/lib/sourcePublication/publicVaultSourceSql";

/** Publicly eligible evidence only; submission-time trust survives later role loss and claiming. */
export async function getLoreVaultSources(artistId: string) {
  const v = alias(artistVaultSources, "v");
  const sources = await db
    .select()
    .from(v)
    .where(and(eq(v.artistId, artistId), publicVaultSourceSql()))
    .orderBy(desc(v.createdAt));
  return sources.filter(source => publicKnowledgeUrl(source.url));
}
