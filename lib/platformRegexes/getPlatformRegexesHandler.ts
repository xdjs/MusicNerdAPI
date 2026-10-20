import { NextResponse } from "next/server";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/platformRegexes — the URL regex for each platform,
 * minus ENS and wallets.
 *
 * @returns 200 with `[{ siteName, regex }]`.
 */
export async function getPlatformRegexesHandler(): Promise<NextResponse> {
  const rows = await db.query.urlmap.findMany();
  const filtered = rows
    .filter(r => r.siteName !== "ens" && r.siteName !== "wallets")
    .map(r => ({ siteName: r.siteName, regex: r.regex }));
  return NextResponse.json(filtered, { status: 200, headers: getCorsHeaders() });
}
