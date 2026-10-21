import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { db } from "@/lib/db/db";
import { users } from "@/lib/db/schema";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Who is calling, and are they an admin. MusicNerdWeb's `requireAdmin` on top
 * of `authenticateRequest`: no valid Privy token is its 401, a signed-in user
 * without `users.is_admin` is a 403.
 *
 * @param request - The incoming request.
 * @returns `{ userId }` for an admin, or a 401 or 403 response.
 */
export async function authenticateAdmin(
  request: Request,
): Promise<{ userId: string } | NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;
  const user = await db.query.users.findFirst({
    where: eq(users.id, auth.userId),
    columns: { isAdmin: true },
  });
  if (user?.isAdmin) return auth;
  return NextResponse.json(
    { status: "error", error: "Forbidden" },
    { status: 403, headers: getCorsHeaders() },
  );
}
