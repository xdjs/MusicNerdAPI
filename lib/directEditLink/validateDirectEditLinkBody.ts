import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/** A valid directEditLink body. `url` and `siteName` are checked per action by the handler, as MusicNerdWeb did. */
export type DirectEditLinkBody = {
  artistId: string;
  action: "set" | "clear";
  url?: string;
  siteName?: string;
  expectedValue?: string | null;
};

/**
 * Validates a POST /api/directEditLink body, with MusicNerdWeb's messages, in
 * its order. A body that isn't JSON is treated as empty; a `url` or
 * `siteName` that isn't a string is treated as missing.
 *
 * @param body - The parsed JSON body, or null.
 * @returns The body, or a 400 `{ status, error }`.
 */
export function validateDirectEditLinkBody(body: unknown): DirectEditLinkBody | NextResponse {
  const fail = (error: string) =>
    NextResponse.json({ status: "error", error }, { status: 400, headers: getCorsHeaders() });
  const { artistId, action, url, siteName, expectedValue } = (body ?? {}) as Record<
    string,
    unknown
  >;
  if (!artistId || !action) return fail("artistId and action are required");
  if (action !== "set" && action !== "clear") return fail("action must be 'set' or 'clear'");
  if (!z.uuid().safeParse(artistId).success) return fail("artistId must be a UUID");
  if (
    action === "clear" &&
    (siteName === "spotify" || siteName === "deezer") &&
    (expectedValue === undefined ||
      (expectedValue !== null && (typeof expectedValue !== "string" || !expectedValue.trim())))
  )
    return fail("expectedValue is required for catalog disconnect; refresh the profile");
  return {
    ...(expectedValue === null || typeof expectedValue === "string" ? { expectedValue } : {}),
    artistId: artistId as string,
    action,
    url: typeof url === "string" ? url : undefined,
    siteName: typeof siteName === "string" ? siteName : undefined,
  };
}
