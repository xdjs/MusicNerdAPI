import { NextResponse } from "next/server";
import { BOOKMARK_CACHE_HEADERS } from "@/lib/account/const";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * A bookmarks response: JSON, CORS, and private no-store caching.
 *
 * @param body - The JSON body.
 * @param status - The HTTP status; 200 by default.
 * @returns The response.
 */
export function bookmarkJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...getCorsHeaders(), ...BOOKMARK_CACHE_HEADERS },
  });
}
