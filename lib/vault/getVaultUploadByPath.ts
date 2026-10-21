import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistVaultSources } from "@/lib/db/schema";
import type { VaultSource } from "@/lib/vault/types";

/**
 * The artist's source stored at a storage key. Publication reconciliation
 * must tell a missing row from a failed read, so a failed read throws.
 *
 * @param artistId - The artist.
 * @param filePath - The storage key (`<artistId>/<name>`).
 * @returns The source, or undefined when none is stored there.
 */
export async function getVaultUploadByPath(
  artistId: string,
  filePath: string,
): Promise<VaultSource | undefined> {
  return db.query.artistVaultSources.findFirst({
    where: and(
      eq(artistVaultSources.artistId, artistId),
      eq(artistVaultSources.filePath, filePath),
    ),
  });
}
