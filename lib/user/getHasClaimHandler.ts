import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { db } from "@/lib/db/db";

export async function getHasClaimHandler(request: Request): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) {
    return NextResponse.json({ hasClaim: false, artistId: null }, { headers: getCorsHeaders() });
  }
  const rows = await db.execute(
    sql`SELECT artist_id FROM artist_claims WHERE user_id = ${auth.userId}::uuid AND status = 'approved' LIMIT 1`,
  );
  const claim = rows[0] as { artist_id: string } | undefined;
  return NextResponse.json(
    { hasClaim: !!claim, artistId: claim?.artist_id ?? null },
    { headers: getCorsHeaders() },
  );
}
