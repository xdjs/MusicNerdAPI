import { extractPgError } from "@/lib/mcp/extractPgError";
import { MappingConcurrentWriteError } from "@/lib/mcp/MappingConcurrentWriteError";
import { MappingConflictError } from "@/lib/mcp/MappingConflictError";

/**
 * Turns a unique violation from `artist_id_mappings` into the mapping error it
 * means: the platform-id unique is a conflict with another artist, the
 * artist-platform unique is a concurrent write of the same slot. Anything else
 * is rethrown.
 *
 * @param err - What the insert or update threw.
 * @param platform - The platform being mapped.
 * @param platformId - The id being mapped.
 * @returns Never; always throws.
 */
export function handleUniqueViolation(err: unknown, platform: string, platformId: string): never {
  const pg = extractPgError(err);
  if (pg && pg.code === "23505") {
    if (pg.constraint === "artist_id_mappings_platform_id_uniq") {
      throw new MappingConflictError(
        `platformId ${platformId} on ${platform} is already mapped to a different artist`,
      );
    }
    throw new MappingConcurrentWriteError(
      `A mapping for ${platform} already exists for this artist (concurrent write)`,
    );
  }
  throw err;
}
