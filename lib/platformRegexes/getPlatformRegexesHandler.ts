import { NextResponse } from "next/server";
import { getAllLinks } from "@/lib/artists/getAllLinks";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/platformRegexes (public): every urlmap platform's pattern
 * except `ens` and `wallets`. MusicNerdWeb returned a bare array; here it is
 * `regexes` inside the `{ status }` envelope.
 *
 * @returns 200 `{ status, regexes }`, or 500 when the table can't be read.
 */
export async function getPlatformRegexesHandler(): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const regexes = (await getAllLinks())
      .filter(link => link.siteName !== "ens" && link.siteName !== "wallets")
      .map(link => ({ siteName: link.siteName, regex: link.regex }));
    return NextResponse.json({ status: "ok", regexes }, { status: 200, headers });
  } catch (e) {
    console.error("[platformRegexes] Error:", e);
    return NextResponse.json(
      { status: "error", error: "Could not load platform patterns" },
      { status: 500, headers },
    );
  }
}
