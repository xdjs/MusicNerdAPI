import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/db";
import {
  artists,
  artistDocs,
  artistOnboardingSteps,
  artistResearchJobs,
  artistVaultSources,
} from "@/lib/db/schema";

/** Link columns the claim build discovers; reset nulls all of them.
 *  Deezer is excluded: it comes from `artist_id_mappings`, not discovery,
 *  so the build cannot re-find it. */
const DISCOVERABLE_LINK_COLUMNS = [
  "spotify",
  "instagram",
  "tiktok",
  "x",
  "youtube",
  "soundcloud",
  "bandcamp",
  "twitch",
  "facebook",
  "discogs",
] as const;

/**
 * Removes everything the claim build wrote for an artist and returns the
 * removed values as a backup. The artist's own edits, uploads, interview
 * answers and social posts stay.
 *
 * @param artistId - The artist to reset.
 * @returns The removed data for the caller to keep as a backup, or null if the artist does not exist.
 */
export async function resetClaimBuild(artistId: string) {
  return db.transaction(async tx => {
    // 1. Steps
    const deletedSteps = await tx
      .delete(artistOnboardingSteps)
      .where(eq(artistOnboardingSteps.artistId, artistId))
      .returning({ step: artistOnboardingSteps.step });

    // 2. Links -- read then null
    const [artist] = await tx
      .select({
        spotify: artists.spotify,
        instagram: artists.instagram,
        tiktok: artists.tiktok,
        x: artists.x,
        youtube: artists.youtube,
        soundcloud: artists.soundcloud,
        bandcamp: artists.bandcamp,
        twitch: artists.twitch,
        facebook: artists.facebook,
        discogs: artists.discogs,
        bio: artists.bio,
      })
      .from(artists)
      .where(eq(artists.id, artistId));

    if (!artist) return null;

    const links: Record<string, string> = {};
    for (const col of DISCOVERABLE_LINK_COLUMNS) {
      const value = artist[col];
      if (value != null) links[col] = value;
    }

    // Always null all discoverable links and bio
    await tx
      .update(artists)
      .set({
        spotify: null,
        instagram: null,
        tiktok: null,
        x: null,
        youtube: null,
        soundcloud: null,
        bandcamp: null,
        twitch: null,
        facebook: null,
        discogs: null,
        bio: null,
      })
      .where(eq(artists.id, artistId));

    // 3. Research sources
    const deletedSources = await tx
      .delete(artistVaultSources)
      .where(
        and(eq(artistVaultSources.artistId, artistId), eq(artistVaultSources.origin, "research")),
      )
      .returning({ id: artistVaultSources.id });

    // 4. Lore doc
    const deletedDocs = await tx
      .delete(artistDocs)
      .where(eq(artistDocs.artistId, artistId))
      .returning({ id: artistDocs.id });

    // 5. Pending/running jobs
    const deletedJobs = await tx
      .delete(artistResearchJobs)
      .where(
        and(
          eq(artistResearchJobs.artistId, artistId),
          inArray(artistResearchJobs.status, ["pending", "running"]),
        ),
      )
      .returning({ id: artistResearchJobs.id });

    return {
      steps: deletedSteps.map(r => r.step),
      links,
      bio: artist.bio ?? null,
      doc: deletedDocs.length > 0,
      sources: deletedSources.length,
      jobs: deletedJobs.length,
    };
  });
}
