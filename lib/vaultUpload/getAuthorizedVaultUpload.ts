import { withArtistUploadWrite } from "@/lib/ownership/withArtistUploadWrite";
import { getVaultUploadByPath } from "@/lib/vault/getVaultUploadByPath";

/** Read retry/recovery results only while the original claim and actor remain authorized. */
export async function getAuthorizedVaultUpload(
  artistId: string,
  path: string,
  userId: string,
  expectedClaimId: string | null,
) {
  return withArtistUploadWrite(artistId, userId, expectedClaimId, tx =>
    getVaultUploadByPath(artistId, path, tx),
  );
}
