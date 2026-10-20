import { NextResponse } from "next/server";
import { eq, desc, count } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { db } from "@/lib/db/db";
import { artistSelfEdits } from "@/lib/db/schema";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/selfEdits — paginated self-edits for the authenticated user.
 *
 * @param request - Authenticated request with optional `?page=` (default 1).
 * @returns 200 with `{ status: "ok", entries, total, page, pageCount }`.
 */
export async function getSelfEditsHandler(request: Request): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const perPage = 10;
  const offset = (page - 1) * perPage;

  const [{ total }] = await db
    .select({ total: count() })
    .from(artistSelfEdits)
    .where(eq(artistSelfEdits.userId, auth.userId));

  const entries = await db
    .select()
    .from(artistSelfEdits)
    .where(eq(artistSelfEdits.userId, auth.userId))
    .orderBy(desc(artistSelfEdits.createdAt))
    .limit(perPage)
    .offset(offset);

  return NextResponse.json(
    {
      status: "ok",
      entries,
      total,
      page,
      pageCount: Math.ceil(total / perPage),
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
