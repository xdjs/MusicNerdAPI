import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { getPublicUrl } from "@/lib/storage/getPublicUrl";
import { VAULT_BUCKET } from "@/lib/storage/const";
import { MAX_CHAT_PDF_BYTES, type ChatPdf } from "@/lib/chatPdf/types";

/** Filter eligibility and rank titles before bounding metadata; never expand the shared corpus. */
export async function loadChatPdfs(
  artistId: string,
  sourceId?: string,
  query = "",
  exactTitle = false,
  mentionedIn?: string,
): Promise<ChatPdf[]> {
  const terms = [
    ...new Set(
      query
        .toLowerCase()
        .split(/\W+/)
        .filter(t => t.length > 2),
    ),
  ].slice(0, 16);
  const title = sql`lower(coalesce(v.title, v.file_name, 'PDF'))`;
  const rank = terms.length
    ? sql.join(
        terms.map(term => sql`case when position(${term} in ${title}) > 0 then 1 else 0 end`),
        sql` + `,
      )
    : sql`cast(0 as integer)`;
  return db.execute<ChatPdf>(sql`
    select v.id, coalesce(v.title, v.file_name, 'PDF') as title, v.url, v.file_path as path,
      v.file_size as size, coalesce(v.updated_at, v.created_at)::text as revision,
      c.id::text as "claimId"
    from artist_vault_sources v
    join artist_claims c on c.artist_id=v.artist_id and c.status='approved'
    where v.artist_id=${artistId}::uuid and v.status='approved'
      and v.content_type='application/pdf' and v.file_path is not null
      and v.file_size > 0 and v.file_size <= ${MAX_CHAT_PDF_BYTES}
      and v.url = ${getPublicUrl(VAULT_BUCKET, "")} || v.file_path
      and split_part(v.file_path, '/', 1) = ${artistId}
      and v.file_path ~ '^[a-zA-Z0-9_. -]+(/[a-zA-Z0-9_. -]+)+$'
      and not exists (select 1 from unnest(string_to_array(v.file_path, '/')) segment where segment in ('.','..'))
      and (${sourceId ?? null}::uuid is null or v.id=${sourceId ?? null}::uuid)
      and (${exactTitle}=false or ${title}=lower(${query})
        or (${mentionedIn ?? null}::text is not null and ${title} like '%.pdf'
          and position(${title} in lower(${mentionedIn ?? ""})) > 0))
    order by (case when ${title}=lower(${query}) then 1 else 0 end) desc,
      (${rank}) desc, v.id limit 32`);
}
