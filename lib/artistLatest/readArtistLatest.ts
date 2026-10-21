import { db } from "@/lib/db/db";
import { getStoredPublicLatestCards } from "@/lib/artistLatest/getStoredPublicLatestCards";
import { getStoredLatestProviders } from "@/lib/latestProviders/getStoredLatestProviders";
import { latestActivityTime } from "@/lib/latestProviders/latestActivityTime";

/**
 * An artist's stored Latest: public cards and provider snapshots read in one
 * read-only transaction, newest first. The public Latest endpoint and the
 * profile updates feed both read it; nothing here fetches or writes.
 *
 * @param artistId - The artist.
 * @param name - The artist's name, for image captions.
 * @returns The cards, provider coverage, and whether a configured provider is failed or missing.
 */
export async function readArtistLatest(artistId: string, name: string) {
  const [publicCards, providers] = await db.transaction(
    async tx =>
      Promise.all([
        getStoredPublicLatestCards(artistId, name, tx),
        getStoredLatestProviders(artistId, tx),
      ]),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  const items = [...publicCards, ...providers.items].sort(
    (a, b) => latestActivityTime(b.date) - latestActivityTime(a.date) || a.id.localeCompare(b.id),
  );
  return { items, coverage: providers.coverage, unavailable: providers.unavailable };
}
