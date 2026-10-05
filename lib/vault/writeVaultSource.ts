import { queueApprovedSourceExtraction } from "@/lib/sourceExtraction/queueApprovedSourceExtraction";
import { isMusicSource } from "@/lib/musicLinks/isMusicSource";
import { canSaveMusicDestination } from "@/lib/musicLinks/canSaveMusicDestination";
import { sql } from "drizzle-orm";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { artistVaultSources } from "@/lib/db/schema";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import type { ScopedWriteDb } from "@/lib/ownership/types";
import type { VaultSource, VaultSourceInput } from "@/lib/vault/types";

/**
 * The insert behind `insertVaultSource`, given the transaction to write in.
 * Origin and activity come from the running operation. When there's no
 * activity, the addition is recorded and linked in the same transaction, and
 * only by the writer that won the uniqueness check.
 *
 * @param writer - The transaction.
 * @param data - The source.
 * @param url - Its canonical URL.
 * @returns The stored source with its activity, or undefined when it already existed.
 */
export async function writeVaultSource(
  writer: ScopedWriteDb,
  data: VaultSourceInput,
  url: string,
): Promise<(VaultSource & { activityId: string | null }) | undefined> {
  const context = getArtistOperationOwnership(data.artistId);
  const userId = context?.userId;
  const origin = context?.sourceOrigin ?? (userId ? "submission" : "unknown");
  const music = isMusicSource({ ...data, url });
  if (
    origin === "research" &&
    music &&
    !(await canSaveMusicDestination(writer, data.artistId, url))
  )
    return undefined;
  let activityId = context?.activityId ?? null;
  const [source] = await writer
    .insert(artistVaultSources)
    .values({
      artistId: data.artistId,
      origin,
      activityId,
      url,
      title: data.title,
      snippet: data.snippet,
      type: music ? "music" : (data.type ?? "article"),
      status: data.status ?? "pending",
      extractedText: data.extractedText,
      ogImage: data.ogImage,
      podcastEpisodeKey: data.podcastEpisodeKey,
      podcastShowTitle: data.podcastShowTitle,
      podcastEpisodeTitle: data.podcastEpisodeTitle,
      publishedAt: data.publishedAt ?? null,
    })
    .onConflictDoNothing({ target: [artistVaultSources.artistId, artistVaultSources.url] })
    .returning();
  // Undefined when a concurrent run won the race: the source is there either way.
  if (!source) return undefined;
  if (!activityId) {
    activityId = await recordArtistActivity(
      data.artistId,
      origin === "submission" ? "source_submission" : "source_added",
      { userId, sourceId: source.id, trigger: context?.trigger ?? "editor_source" },
      writer,
    );
    await writer.execute(
      sql`update artist_vault_sources set activity_id = ${activityId}::uuid where id = ${source.id}::uuid`,
    );
  }
  await queueApprovedSourceExtraction(writer, source, activityId);
  return { ...source, activityId };
}
