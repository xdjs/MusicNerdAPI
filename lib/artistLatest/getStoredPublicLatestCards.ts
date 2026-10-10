import { sql } from "drizzle-orm";
import type { TransactionDb } from "@/lib/ownership/types";
import { db } from "@/lib/db/db";

/** Read only own Instagram posts and explicitly published responses. No provider calls. */
export async function getStoredPublicLatestCards(
  artistId: string,
  name: string,
  store: Pick<TransactionDb, "execute"> = db,
) {
  const posts = await store.execute<{
    id: string;
    caption: string | null;
    url: string;
    posted_at: string | Date;
    image_url: string | null;
    thumbnail: { url?: string; width?: number; height?: number } | null;
  }>(sql`select id,caption,url,posted_at,
    coalesce(raw->>'displayUrl',raw->>'thumbnailSrc',raw->'images'->>0) as image_url, raw->'_musicnerdThumbnail' as thumbnail
    from artist_social_posts where artist_id=${artistId}::uuid and platform='instagram' and is_own_post=true
    and posted_at is not null and posted_at<=now()
    and coalesce(raw->>'isRepost','false')!='true' and coalesce(raw->>'isRetweet','false')!='true'
    order by posted_at desc,id limit 9`);
  const answers = await store.execute<{
    id: string;
    question: string;
    answer: string;
    created_at: string | Date;
  }>(sql`select a.id,a.question,a.answer,a.created_at from artist_interview_answers a
    where a.artist_id=${artistId}::uuid and (a.source='followup' or (a.source='onboarding' and exists(
      select 1 from artist_onboarding_steps p where p.artist_id=a.artist_id and p.step='publish')))
    and a.answer is not null and length(trim(a.answer))>0 and a.created_at<=now()
    order by a.created_at desc,a.id limit 6`);
  const safe = (value: string | null) => {
    try {
      const u = new URL(value ?? "");
      return u.protocol === "https:" && !u.username && !u.password ? u.href : null;
    } catch {
      return null;
    }
  };
  return [
    ...posts
      .filter(p => {
        try {
          const u = new URL(p.url);
          return (
            !!safe(p.url) &&
            ["instagram.com", "www.instagram.com"].includes(u.hostname) &&
            /^\/(p|reel|tv)\/[^/]+\/?$/.test(u.pathname)
          );
        } catch {
          return false;
        }
      })
      .map(p => ({
        id: `instagram:${p.id}`,
        kind: "instagram" as const,
        title: "From Instagram",
        text: p.caption?.trim() || "A new moment shared on Instagram.",
        date: new Date(p.posted_at).toISOString(),
        imageUrl: safe(p.image_url),
        imageCaption: `Instagram post by ${name}`,
        ...(p.thumbnail?.url === safe(p.image_url) &&
        Number.isInteger(p.thumbnail?.width) &&
        Number.isInteger(p.thumbnail?.height) &&
        p.thumbnail!.width! > 0 &&
        p.thumbnail!.height! > 0 &&
        p.thumbnail!.width! <= 640 &&
        p.thumbnail!.height! <= 640
          ? { imageDimensions: { width: p.thumbnail!.width!, height: p.thumbnail!.height! } }
          : {}),
        sourceUrl: p.url,
        sourceLabel: "View on Instagram",
      })),
    ...answers.map(a => ({
      id: `interview:${a.id}`,
      kind: "interview" as const,
      title: a.question,
      text: a.answer,
      date: new Date(a.created_at).toISOString(),
      imageUrl: null,
      imageCaption: `${name} portrait`,
      sourceUrl: null,
      sourceLabel: "View the source behind this answer",
    })),
  ];
}
