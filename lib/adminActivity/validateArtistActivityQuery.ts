import { z } from "zod";
import type { ArtistActivityQuery } from "@/lib/adminActivity/types";
import { readPage } from "@/lib/db/readPage";

const uuid = z.uuid();

/**
 * Reads the query of GET /api/admin/activity the way MusicNerdWeb's admin page
 * read its search params: `query` trimmed to 100 characters, `action` cut to
 * 60, an `eventId` that isn't a UUID ignored, and a bad `page` as page 1.
 *
 * @param request - The request.
 * @returns The filters; never an error.
 */
export function validateArtistActivityQuery(request: Request): ArtistActivityQuery {
  const params = new URL(request.url).searchParams;
  const eventId = params.get("eventId") ?? "";
  return {
    query: (params.get("query") ?? "").trim().slice(0, 100),
    action: (params.get("action") ?? "").slice(0, 60),
    eventId: uuid.safeParse(eventId).success ? eventId : "",
    page: readPage(params),
  };
}
