import { db } from "@/lib/db/db";
import { z } from "zod";
import { getArtistById } from "@/lib/artists/getArtistById";
import { getStoredLatestProviders } from "@/lib/latestProviders/getStoredLatestProviders";
import { latestActivityTime } from "@/lib/latestProviders/latestActivityTime";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getStoredPublicLatestCards } from "./getStoredPublicLatestCards";
/** Public, read-only aggregation of eligible stored activity; never queues research. */
export async function getArtistLatestHandler(id: string) {
  const headers = { ...getCorsHeaders(), "Cache-Control": "no-store" };
  if (!z.string().uuid().safeParse(id).success)
    return Response.json({ status: "error", error: "Invalid artist ID" }, { status: 400, headers });
  try {
    const artist = await getArtistById(id);
    if (!artist)
      return Response.json(
        { status: "error", error: "Artist not found" },
        { status: 404, headers },
      );
    const [publicCards, providers] = await db.transaction(
      async tx =>
        Promise.all([
          getStoredPublicLatestCards(id, artist.name ?? "the artist", tx),
          getStoredLatestProviders(id, tx),
        ]),
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
    const items = [...publicCards, ...providers.items].sort(
      (a, b) => latestActivityTime(b.date) - latestActivityTime(a.date) || a.id.localeCompare(b.id),
    );
    return Response.json(
      { status: "ok", items, coverage: providers.coverage, unavailable: providers.unavailable },
      { headers },
    );
  } catch {
    return Response.json(
      { status: "error", error: "Latest is temporarily unavailable" },
      { status: 503, headers },
    );
  }
}
