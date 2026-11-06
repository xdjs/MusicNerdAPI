import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Validates POST /api/artist/{id}/links: a UUID artist id and a non-empty `url`.
 *
 * @param body - The parsed JSON body, or null.
 * @param id - The artist id from the path.
 * @returns `{ artistId, url }` with the url trimmed, or a 400 `{ status, error }`.
 */
export function validateArtistLinkBody(
  body: unknown,
  id: string,
): { artistId: string; url: string } | NextResponse {
  const fail = (error: string) =>
    NextResponse.json({ status: "error", error }, { status: 400, headers: getCorsHeaders() });
  if (!z.uuid().safeParse(id).success) return fail("id must be a UUID");
  const url = (body as { url?: unknown } | null)?.url;
  if (typeof url !== "string" || !url.trim()) return fail("url is required");
  return { artistId: id, url: url.trim() };
}
