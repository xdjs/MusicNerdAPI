import { lockVerifiedDeezerMapping } from "@/lib/providerIdentity/lockVerifiedDeezerMapping";
import { and, eq, sql } from "drizzle-orm";
import { acquireArtistPlatformWriteLocks } from "@/lib/artistLinks/acquireArtistPlatformWriteLocks";
import { db } from "@/lib/db/db";
import { artistIdMappings, artists } from "@/lib/db/schema";
import { CONFIDENCE_PRIORITY, VALID_MAPPING_PLATFORMS, VALID_SOURCES } from "@/lib/mcp/const";
import { handleUniqueViolation } from "@/lib/mcp/handleUniqueViolation";
import { MappingConflictError } from "@/lib/mcp/MappingConflictError";
import { MappingNotFoundError } from "@/lib/mcp/MappingNotFoundError";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";
import type { MappingConfidence, ResolveResult } from "@/lib/mcp/types";

/**
 * Stores one cross-platform id mapping, in a transaction that takes the same
 * advisory locks MusicNerdWeb's link writers take. A lower-confidence
 * submission than the stored one is skipped; equal confidence overwrites,
 * latest wins. For spotify and deezer the artist's first-class column must
 * agree with the mapping.
 *
 * @param params - The mapping and the reporting key's hash.
 * @returns Whether a row was created, updated or skipped, with the previous mapping when there was one.
 */
export async function resolveArtistMapping(params: {
  artistId: string;
  platform: string;
  platformId: string;
  confidence: string;
  source: string;
  reasoning?: string;
  apiKeyHash?: string;
}): Promise<ResolveResult> {
  const { artistId, platform, platformId, confidence, source, reasoning, apiKeyHash } = params;

  if (!VALID_MAPPING_PLATFORMS.has(platform)) {
    throw new MappingValidationError(`Invalid platform: ${platform}`);
  }
  if (!VALID_SOURCES.has(source)) {
    throw new MappingValidationError(`Invalid source: ${source}`);
  }
  if (!(confidence in CONFIDENCE_PRIORITY)) {
    throw new MappingValidationError(`Invalid confidence level: ${confidence}`);
  }
  if (!platformId.trim()) {
    throw new MappingValidationError("platformId cannot be empty");
  }

  return db.transaction(async transaction => {
    await acquireArtistPlatformWriteLocks(transaction, artistId, platform, platformId);

    // First-class ids are selected so a mapping cannot silently disagree with
    // the canonical Spotify/Deezer column.
    const artist = await transaction.query.artists.findFirst({
      where: eq(artists.id, artistId),
      columns: { id: true, spotify: true, deezer: true },
    });
    if (!artist) {
      throw new MappingNotFoundError(`Artist not found: ${artistId}`);
    }

    if (platform === "spotify" || platform === "deezer") {
      const directColumn = platform === "spotify" ? artists.spotify : artists.deezer;
      const directOwner = await transaction.query.artists.findFirst({
        where: eq(directColumn, platformId),
        columns: { id: true },
      });
      if (directOwner && directOwner.id !== artistId) {
        throw new MappingConflictError(
          `platformId ${platformId} on ${platform} is already owned by a different artist`,
        );
      }

      const firstClassValue = platform === "spotify" ? artist.spotify : artist.deezer;
      if (firstClassValue?.trim() && firstClassValue !== platformId) {
        throw new MappingConflictError(
          `The artist's ${platform} field already contains a different platform ID`,
        );
      }
    }

    const existing = await transaction.query.artistIdMappings.findFirst({
      where: and(eq(artistIdMappings.artistId, artistId), eq(artistIdMappings.platform, platform)),
    });

    if (existing) {
      const existingPriority = CONFIDENCE_PRIORITY[existing.confidence] ?? 0;
      const newPriority = CONFIDENCE_PRIORITY[confidence] ?? 0;

      if (newPriority < existingPriority) {
        return {
          created: false,
          updated: false,
          skipped: true,
          previousMapping: { platformId: existing.platformId, confidence: existing.confidence },
        };
      }

      if (
        platform === "deezer" &&
        !(await lockVerifiedDeezerMapping(transaction, artist, platformId))
      )
        throw new MappingConflictError(
          "Deezer mapping identity not corroborated or changed during verification",
        );
      try {
        await transaction
          .update(artistIdMappings)
          .set({
            platformId,
            confidence: confidence as MappingConfidence,
            source,
            reasoning: reasoning ?? null,
            apiKeyHash: apiKeyHash ?? null,
            resolvedAt: sql`now()`,
            updatedAt: sql`now()`,
          })
          .where(
            and(eq(artistIdMappings.artistId, artistId), eq(artistIdMappings.platform, platform)),
          );
      } catch (err: unknown) {
        handleUniqueViolation(err, platform, platformId);
      }

      return {
        created: false,
        updated: true,
        skipped: false,
        previousMapping: { platformId: existing.platformId, confidence: existing.confidence },
      };
    }

    if (
      platform === "deezer" &&
      !(await lockVerifiedDeezerMapping(transaction, artist, platformId))
    )
      throw new MappingConflictError(
        "Deezer mapping identity not corroborated or changed during verification",
      );
    try {
      await transaction.insert(artistIdMappings).values({
        artistId,
        platform,
        platformId,
        confidence: confidence as MappingConfidence,
        source,
        reasoning: reasoning ?? null,
        apiKeyHash: apiKeyHash ?? null,
      });
    } catch (err: unknown) {
      handleUniqueViolation(err, platform, platformId);
    }

    return { created: true, updated: false, skipped: false };
  });
}
