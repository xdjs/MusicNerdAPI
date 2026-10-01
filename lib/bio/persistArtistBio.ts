import { and, eq, sql } from "drizzle-orm";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { BioConflictError } from "@/lib/bio/BioConflictError";
import { saveBioVersions } from "@/lib/bio/saveBioVersions";
import type { BioWriteOwnership } from "@/lib/bio/types";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { artistBioVersions, artistDocs, artistOnboardingSteps, artists } from "@/lib/db/schema";
import { authorizeLockedArtistWrite } from "@/lib/ownership/authorizeLockedArtistWrite";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Writes an artist's bio under the artist row lock, as every bio writer does.
 * A model call must never hold the lock: generate first, then pass the bio it
 * started from as `expectedBio`.
 *
 * Onboarding publishes one snapshot: the step confirmations, the Lore document
 * and the bio commit together or not at all. A pinned bio is never replaced by
 * generated text, and a generated bio that raced an edit is refused.
 *
 * @param artistId - The artist.
 * @param bio - The new bio.
 * @param options - How the write is fenced and what goes with it.
 * @param options.ownership - The claim it started under and, for a person's action, their user id.
 * @param options.generated - The bio is model output.
 * @param options.expectedBio - For generated text: the bio it was generated against.
 * @param options.document - The Lore document and its sources, published with the bio.
 * @param options.confirmSteps - Onboarding steps confirmed in the same transaction.
 * @returns The artist's bio after the write. Throws OwnershipChangedError or BioConflictError.
 */
export async function persistArtistBio(
  artistId: string,
  bio: string,
  options: {
    ownership: BioWriteOwnership;
    generated?: boolean;
    expectedBio?: string | null;
    document?: { content: string; sources: unknown[] };
    confirmSteps?: ("interview" | "publish")[];
  },
): Promise<string | null> {
  return db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    if (!options?.ownership) throw new OwnershipChangedError();
    const { ownership } = options;
    if (ownership.userId) {
      await authorizeLockedArtistWrite(tx, artistId, {
        userId: ownership.userId,
        expectedClaimId: ownership.expectedClaimId,
      });
    } else {
      // Automatic generation has no initiating user, but still can't publish
      // across a claim change or revocation.
      const claim = await findApprovedClaim(tx, artistId);
      if ((claim?.id ?? null) !== ownership.expectedClaimId) throw new OwnershipChangedError();
    }
    const artist = await tx.query.artists.findFirst({ where: eq(artists.id, artistId) });
    if (!artist) throw new Error("Artist not found");
    const pinned = await tx.query.artistBioVersions.findFirst({
      where: and(eq(artistBioVersions.artistId, artistId), eq(artistBioVersions.isPinned, true)),
    });
    if (pinned) {
      if (options.generated) throw new BioConflictError();
      if (bio !== pinned.bioText)
        throw new Error("Unpin your bio before editing it. Your saved version will be kept.");
      return artist.bio;
    }
    if (options.generated && artist.bio !== options.expectedBio) throw new BioConflictError();
    for (const step of options.confirmSteps ?? []) {
      await tx
        .insert(artistOnboardingSteps)
        .values({ artistId, step })
        .onConflictDoNothing({
          target: [artistOnboardingSteps.artistId, artistOnboardingSteps.step],
        });
    }
    if (options.document) {
      const { content, sources } = options.document;
      await tx
        .insert(artistDocs)
        .values({ artistId, content, sources })
        .onConflictDoUpdate({
          target: [artistDocs.artistId],
          set: { content, sources, updatedAt: sql`(now() AT TIME ZONE 'utc'::text)` },
        });
    }
    if (artist.bio === bio) return bio;
    await saveBioVersions(tx, artistId, [artist.bio, bio]);
    await tx.update(artists).set({ bio }).where(eq(artists.id, artistId));
    const automatic = options.generated && !ownership.userId && !options.document;
    await recordArtistActivity(
      artistId,
      options.generated ? "about_generated" : "about_edited",
      {
        userId: ownership.userId,
        actorKind: ownership.userId ? "user" : automatic ? "system" : "unknown",
        trigger: options.document ? "onboarding" : automatic ? "automatic_about" : "about_editor",
      },
      tx,
    );
    return bio;
  });
}
