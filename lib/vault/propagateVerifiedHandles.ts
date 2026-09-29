import { getAllLinks } from "@/lib/artists/getAllLinks";
import { ACCOUNT_PLATFORMS, PROBE_BLIND_PLATFORMS, PROPAGATION_BUDGET_MS } from "@/lib/vault/const";
import { holdsAnswerFor } from "@/lib/vault/holdsAnswerFor";
import { probeHandlesOnPlatform } from "@/lib/vault/probeHandlesOnPlatform";
import { writeArtistLink } from "@/lib/vault/writeArtistLink";

/**
 * Carries the handles we verified to the account platforms we have nothing
 * for. Every handle is probed and a tie abstains: Pete Rango is p3t3rango on
 * Instagram and peterango on SoundCloud, and taking the first answer gave him
 * the wrong Twitch. The deadline stops the work itself, not just the wait.
 *
 * @param artistId - The artist.
 * @param verified - Handles adopted earlier in the run.
 * @param artist - The artist row snapshot; updated as links are written.
 * @param artistName - Their name.
 * @param callerDeadline - The caller's deadline (epoch ms); the pass also stops after its own budget.
 * @param provisional - Columns holding a discovery guess (see holdsAnswerFor).
 * @returns How many links were written. Never throws.
 */
export async function propagateVerifiedHandles(
  artistId: string,
  verified: Set<string>,
  artist: Record<string, unknown>,
  artistName: string,
  callerDeadline: number = Number.POSITIVE_INFINITY,
  provisional?: Set<string>,
): Promise<number> {
  const handles = [...verified].filter(h => h.length >= 3);
  if (handles.length === 0) return 0;
  const deadline = Math.min(Date.now() + PROPAGATION_BUDGET_MS, callerDeadline);

  let adopted = 0;
  try {
    const urlmap = await getAllLinks();
    for (const platform of ACCOUNT_PLATFORMS) {
      if (Date.now() > deadline) {
        console.log("[vaultWebSearch] Propagation budget spent, stopping");
        break;
      }
      if (holdsAnswerFor(artist, platform, provisional)) continue;
      if (PROBE_BLIND_PLATFORMS.has(platform)) continue;
      const pattern = urlmap.find(u => u.siteName === platform)?.appStringFormat;
      if (!pattern?.includes("%@")) continue;

      const { resolved, scannedAll } = await probeHandlesOnPlatform(
        artistId,
        platform,
        pattern,
        handles,
        artistName,
        deadline,
      );
      if (!scannedAll) {
        console.log(
          `[vaultWebSearch] ${platform} scan ran out of time before checking every handle — leaving empty rather than guessing`,
        );
        continue;
      }
      if (resolved.length !== 1) {
        if (resolved.length > 1) {
          console.log(
            `[vaultWebSearch] ${platform} answers for ${resolved.join(" and ")} — cannot tell which is theirs, leaving empty`,
          );
        }
        continue;
      }
      try {
        await writeArtistLink(artistId, platform, resolved[0], provisional, artist);
        console.log(`[vaultWebSearch] Propagated verified handle -> ${platform}=${resolved[0]}`);
        adopted++;
      } catch (e) {
        console.warn(`[vaultWebSearch] Could not propagate ${platform}:`, e);
      }
    }
  } catch (e) {
    console.error("[vaultWebSearch] Propagation pass failed:", e);
  }
  return adopted;
}
