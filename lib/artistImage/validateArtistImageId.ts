import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * The image route's artist id: a UUID, checked before the database is read.
 *
 * @param id - The path segment.
 * @returns The id, or an empty 400 with `Cache-Control: no-store`.
 */
export function validateArtistImageId(id: string): string | Response {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return new Response(null, {
      status: 400,
      headers: { ...getCorsHeaders(), "Cache-Control": "no-store" },
    });
  return id;
}
