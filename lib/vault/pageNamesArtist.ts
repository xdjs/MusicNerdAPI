import { titleMatchesArtist } from "@/lib/artists/titleMatchesArtist";
import { fetchPageContent } from "@/lib/pages/fetchPageContent";
import { VERIFY_TIMEOUT_MS } from "@/lib/vault/const";

/**
 * Does this profile page's title name the artist? MusicBrainz curates entities,
 * not people: Sherwinn Brice's entry lists his company's Instagram beside his
 * own, and only the page says which is him.
 *
 * @param url - The profile URL.
 * @param artistName - The artist's name.
 * @returns True when the page reads and its title names them.
 */
export async function pageNamesArtist(url: string, artistName: string): Promise<boolean> {
  const page = await fetchPageContent(url, { timeoutMs: VERIFY_TIMEOUT_MS }).catch(() => null);
  return !!page?.title && titleMatchesArtist(page.title, artistName);
}
