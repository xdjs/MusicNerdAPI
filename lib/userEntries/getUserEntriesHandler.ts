import { NextResponse } from "next/server";
import { eq, and, like, asc, desc, count, or } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { db } from "@/lib/db/db";
import { ugcresearch } from "@/lib/db/schema";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/userEntries — paginated UGC entries with filters.
 *
 * Query params: `?page=`, `?siteName=`, `?status=approved|pending`,
 * `?query=`, `?order=oldest`, `?all=true`.
 *
 * @param request - Authenticated request.
 * @returns 200 with `{ status: "ok", entries, total, pageCount, platforms }`.
 */
export async function getUserEntriesHandler(request: Request): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const siteName = url.searchParams.get("siteName");
  const status = url.searchParams.get("status");
  const query = url.searchParams.get("query");
  const order = url.searchParams.get("order");
  const all = url.searchParams.get("all") === "true";
  const perPage = all ? 1000 : 10;
  const offset = (page - 1) * perPage;

  const conditions = [eq(ugcresearch.userId, auth.userId)];

  if (siteName) conditions.push(eq(ugcresearch.siteName, siteName));
  if (status === "approved") conditions.push(eq(ugcresearch.accepted, true));
  else if (status === "pending") conditions.push(eq(ugcresearch.accepted, false));
  if (query) {
    conditions.push(
      or(
        like(ugcresearch.name, `%${query}%`),
        like(ugcresearch.ugcUrl, `%${query}%`),
        like(ugcresearch.siteUsername, `%${query}%`),
      )!,
    );
  }

  const where = and(...conditions);

  const [{ total }] = await db.select({ total: count() }).from(ugcresearch).where(where);

  const entries = await db
    .select()
    .from(ugcresearch)
    .where(where)
    .orderBy(order === "oldest" ? asc(ugcresearch.createdAt) : desc(ugcresearch.createdAt))
    .limit(perPage)
    .offset(offset);

  const platformRows = await db
    .selectDistinct({ siteName: ugcresearch.siteName })
    .from(ugcresearch)
    .where(eq(ugcresearch.userId, auth.userId));
  const platforms = platformRows.map(r => r.siteName).filter(Boolean) as string[];

  return NextResponse.json(
    { status: "ok", entries, total, pageCount: Math.ceil(total / perPage), platforms },
    { status: 200, headers: getCorsHeaders() },
  );
}
