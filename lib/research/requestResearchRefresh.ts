import { queueLoreRefresh } from "@/lib/research/queueLoreRefresh";
import { queueSocialIngest } from "@/lib/research/queueSocialIngest";
import { getResearchJobs } from "@/lib/research/getResearchJobs";
import { reopenResearchJob } from "@/lib/research/reopenResearchJob";
import { RESEARCH_REFRESH_COOLDOWN_MS } from "@/lib/research/const";
import { pluralize } from "@/lib/text/pluralize";

/**
 * "Look again": rebuild the Lore and read what the artist has posted since.
 * The scrape is incremental and rate limited; the message says what happened,
 * in the artist's words, because the button shows it.
 *
 * Runs inside the caller's `withArtistOperation`, so every write re-checks the claim.
 *
 * @param artistId - The artist.
 * @param claimId - The artist's approved claim, read before the edit check.
 * @returns The message to show.
 */
export async function requestResearchRefresh(
  artistId: string,
  claimId: string | null,
): Promise<string> {
  const loreQueued = await queueLoreRefresh(artistId, claimId, { manual: true });
  const loreMessage =
    loreQueued === false
      ? "Lore is already queued or was checked recently. New document changes still trigger a rebuild."
      : "Rebuilding Lore from your current documents.";
  const allJobs = await getResearchJobs(artistId);
  const latestChecking = allJobs.some(
    job =>
      (job.kind as string) === "latest_refresh" &&
      (job.status === "pending" || job.status === "running") &&
      (job.state?.sources as { instagram?: { status?: string } } | undefined)?.instagram?.status ===
        "pending",
  );
  if (latestChecking)
    return `${loreMessage} Update Latest is already checking Instagram. Let it finish before running social research.`;
  const jobs = allJobs.filter(j => j.kind === "social_ingest" || j.kind === "caption_extract");
  const live = jobs.find(j => j.status === "pending" || j.status === "running");
  if (live)
    return live.total
      ? `Already reading your posts (${live.cursor}/${live.total}).`
      : `${loreMessage} Already reading your posts.`;
  const lastFinished =
    jobs
      .map(j => Number(new Date(j.updatedAt ?? 0)))
      .filter(n => Number.isFinite(n) && n > 0)
      .sort((a, b) => b - a)[0] ?? 0;
  if (lastFinished && Date.now() - lastFinished < RESEARCH_REFRESH_COOLDOWN_MS) {
    const mins = Math.ceil((RESEARCH_REFRESH_COOLDOWN_MS - (Date.now() - lastFinished)) / 60000);
    return `${loreMessage} Social posts can be checked again in ${mins} ${pluralize(mins, "minute", "minutes")}.`;
  }
  await reopenResearchJob(artistId, "social_ingest");
  await reopenResearchJob(artistId, "caption_extract");
  const socialQueued = await queueSocialIngest(artistId, { force: true });
  return socialQueued === false
    ? `${loreMessage} Social research could not start. Let any current Latest update finish, then try again.`
    : `${loreMessage} Checking recent posts. Your bio will stay unchanged.`;
}
