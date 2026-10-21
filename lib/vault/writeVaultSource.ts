import { recordSourceAssessment } from "@/lib/directoryPreparation/recordSourceAssessment";
import { queueApprovedSourceExtraction } from "@/lib/sourceExtraction/queueApprovedSourceExtraction";
import { isMusicSource } from "@/lib/musicLinks/isMusicSource";
import { canSaveMusicDestination } from "@/lib/musicLinks/canSaveMusicDestination";
import { sql } from "drizzle-orm";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { rowsOf } from "@/lib/db/rowsOf";
import { artistVaultSources } from "@/lib/db/schema";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import type { ScopedWriteDb } from "@/lib/ownership/types";
import type { SourceProvenance, VaultSource, VaultSourceInput } from "@/lib/vault/types";

/**
 * The insert behind `insertVaultSource`, given the transaction to write in.
 * Origin and activity come from the running operation, or from `provenance`:
 * a submitter's file (`filePath` set) is an `upload`, anything else they send
 * a `submission`, attributed to them. With `approveIfTrusted` it is approved
 * when the submitter is an admin or whitelisted at write time. When there's no
 * activity, the addition is recorded and linked in the same transaction, and
 * only by the writer that won the uniqueness check.
 *
 * @param writer - The transaction.
 * @param data - The source.
 * @param url - Its canonical URL.
 * @param provenance - Who submitted it and why, for a source a user sent in.
 * @returns The stored source with its activity, or undefined when it already existed. Throws when the submitter no longer exists.
 */
export async function writeVaultSource(
  writer: ScopedWriteDb,
  data: VaultSourceInput,
  url: string,
  provenance?: SourceProvenance,
): Promise<(VaultSource & { activityId: string | null }) | undefined> {
  const context = getArtistOperationOwnership(data.artistId);
  const userId = provenance?.userId ?? context?.userId;
  const origin =
    context?.sourceOrigin ?? (userId ? (data.filePath ? "upload" : "submission") : "unknown");
  const music = isMusicSource({ ...data, url });
  if (
    origin === "research" &&
    music &&
    !(await canSaveMusicDestination(writer, data.artistId, url))
  )
    return undefined;
  let status = data.status ?? "pending";
  let trigger = provenance?.trigger;
  if (provenance?.approveIfTrusted) {
    // Hold the current role through publication: a revocation that completed
    // first saves the source pending, a concurrent one waits.
    const [user] = rowsOf(
      await writer.execute(sql`
        select is_admin, is_white_listed from users
        where id = ${provenance.userId}::uuid for share`),
    ) as { is_admin: boolean | null; is_white_listed: boolean | null }[];
    if (!user) throw new Error("Submitting account no longer exists");
    const trusted = !!(user.is_admin || user.is_white_listed);
    status = trusted ? "approved" : "pending";
    if (trusted) trigger = "trusted_submission";
  }
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
      status,
      fileName: data.fileName,
      fileSize: data.fileSize,
      filePath: data.filePath,
      contentType: data.contentType,
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
      origin === "upload"
        ? "source_upload"
        : origin === "submission"
          ? "source_submission"
          : "source_added",
      { userId, sourceId: source.id, trigger: trigger ?? context?.trigger ?? "editor_source" },
      writer,
    );
    await writer.execute(
      sql`update artist_vault_sources set activity_id = ${activityId}::uuid where id = ${source.id}::uuid`,
    );
  }
  if (data.identityAssessed && source.extractedText)
    await recordSourceAssessment(writer, data.artistId, source.id, {
      text: source.extractedText,
      url: source.url,
      updatedAt: source.updatedAt,
    });
  await queueApprovedSourceExtraction(writer, source, activityId);
  return { ...source, activityId };
}
