import { ACCOUNT_PLATFORMS } from "@/lib/vault/const";
import { sql } from "drizzle-orm";
import type { TransactionDb } from "@/lib/ownership/types";
import { rowsOf } from "@/lib/db/rowsOf";
import type { DirectoryMaterial, PreparedSource } from "./types";
/** Read only exact originals with an affirmative, unchanged assessment for this creation. */
export async function loadDirectoryMaterial(
  tx: Pick<TransactionDb, "execute">,
  artistId: string,
  activityId: string,
): Promise<DirectoryMaterial> {
  const [artist] = rowsOf(
    await tx.execute(sql`select * from artists where id=${artistId}::uuid`),
  ) as ({ name: string | null; bio: string | null } & Record<string, unknown>)[];
  if (!artist) throw new Error("Directory artist unavailable");
  const rows = rowsOf(
    await tx.execute(sql`select s.snapshot from artist_source_assessments s
    join artist_vault_sources v on v.id=s.source_id and v.artist_id=s.artist_id
    where s.artist_id=${artistId}::uuid and s.activity_id=${activityId}::uuid
      and v.status in ('pending','approved') and v.file_path is null
      and (s.snapshot-'status'-'updatedAt')=(public.knowledge_vault_source_snapshot(v)-'status'-'updatedAt')
    order by v.id limit 41`),
  ) as { snapshot: PreparedSource }[];
  const manifest = rows.map(row => row.snapshot);
  if (manifest.length > 40 || JSON.stringify(manifest).length > 1_000_000)
    throw new Error("Private preparation exceeds bounded evidence budget");
  if (
    manifest.some(
      s =>
        s.artistId !== artistId ||
        typeof s.extractedText !== "string" ||
        s.extractedText.trim().length < 200 ||
        !/^https?:\/\//.test(s.url),
    )
  )
    throw new Error("Invalid assessed source snapshot");
  const accounts = Object.fromEntries(
    [...ACCOUNT_PLATFORMS].flatMap(key =>
      typeof artist[key] === "string" && artist[key] ? [[key, artist[key] as string]] : [],
    ),
  );
  return { artistName: artist.name ?? "this artist", startingBio: artist.bio, manifest, accounts };
}
