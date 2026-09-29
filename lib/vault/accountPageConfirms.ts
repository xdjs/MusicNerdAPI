import { titleMatchesArtist } from "@/lib/artists/titleMatchesArtist";
import { fetchLinkPreview } from "@/lib/pages/fetchLinkPreview";
import { stripQuery } from "@/lib/sources/stripQuery";
import { HANDLE_STEM_MIN } from "@/lib/vault/const";
import { sharedPrefix } from "@/lib/vault/sharedPrefix";
import type { AccountCandidate } from "@/lib/vault/types";

/**
 * Whether an account page names the artist. The title is the account holder's
 * own name and stands alone, since a real handle often looks nothing like it
 * (p3t3rango). A description naming them is weaker (a promoter's bio lists
 * everyone it books), so then the handle must also start like the name. The
 * page we already read is used, and a preview only when that read got nothing.
 *
 * @param cand - The account candidate.
 * @param artistName - The artist's name.
 * @returns The identity text that confirmed it, or null.
 */
export async function accountPageConfirms(
  cand: AccountCandidate,
  artistName: string,
): Promise<string | null> {
  let title = cand.title;
  if (!title && !cand.description) {
    const preview = await fetchLinkPreview(stripQuery(cand.url)).catch(() => null);
    title = preview?.title ?? "";
  }
  const identity = `${title} ${cand.description}`.trim();
  if (!identity) return null;
  if (titleMatchesArtist(title, artistName)) return identity;
  if (!titleMatchesArtist(identity, artistName)) {
    console.log(
      `[vaultWebSearch] Account page did not name "${artistName}", ignoring: ${cand.url.slice(0, 70)}`,
    );
    return null;
  }
  if (sharedPrefix(cand.id, artistName) < HANDLE_STEM_MIN) {
    console.log(
      `[vaultWebSearch] Only ${cand.siteName}=${cand.id}'s bio mentions "${artistName}" and the handle is unlike it, ignoring`,
    );
    return null;
  }
  return identity;
}
