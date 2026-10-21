import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { listUserEntries } from "@/lib/contributions/listUserEntries";
import { validateUserEntriesQuery } from "@/lib/contributions/validateUserEntriesQuery";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * GET /api/userEntries: the signed-in user's submitted links, ten per page,
 * filterable. Without a valid token the list is empty with `total` 0 and no
 * `platforms`, with a 200, as on MusicNerdWeb. Never cached.
 *
 * @param request - The request; a Privy token, filters optional.
 * @returns 200 with `{ status, entries, total, pageCount, platforms }`, or 500.
 */
export async function getUserEntriesHandler(request: Request) {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse)
      return NextResponse.json({ status: "ok", entries: [], total: 0, pageCount: 0 }, { headers });
    const query = validateUserEntriesQuery(request);
    const result = await listUserEntries(auth.userId, query);
    return NextResponse.json(
      { status: "ok", ...result },
      { headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[API] userEntries error", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
