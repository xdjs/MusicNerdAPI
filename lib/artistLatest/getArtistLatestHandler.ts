import { z } from "zod";
import { getArtistById } from "@/lib/artists/getArtistById";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { readArtistLatest } from "./readArtistLatest";
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
    const { items, coverage, unavailable } = await readArtistLatest(
      id,
      artist.name ?? "the artist",
    );
    return Response.json({ status: "ok", items, coverage, unavailable }, { headers });
  } catch {
    return Response.json(
      { status: "error", error: "Latest is temporarily unavailable" },
      { status: 503, headers },
    );
  }
}
