import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { checkLinkPage } from "@/lib/validateLink/checkLinkPage";
import { getValidatedPlatforms } from "@/lib/validateLink/getValidatedPlatforms";

/**
 * Handles POST /api/validateLink (public): says whether a supported
 * platform's profile page exists. The 400s keep MusicNerdWeb's `valid` and
 * `reason` beside the error.
 *
 * @param request - The request; `{ url }`.
 * @returns 200 `{ status, valid, reason? }`, or 400 `{ status, error, valid, reason }`.
 */
export async function postValidateLinkHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const invalid = (reason: string) =>
    NextResponse.json(
      { status: "error", error: reason, valid: false, reason },
      { status: 400, headers },
    );
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = body?.url;
  if (!url || typeof url !== "string") return invalid("No URL provided");
  const platform = (await getValidatedPlatforms()).find(p => p.regex.test(url));
  if (!platform) return invalid("Unsupported platform or invalid URL");
  return NextResponse.json(
    { status: "ok", ...(await checkLinkPage(url, platform)) },
    { status: 200, headers },
  );
}
