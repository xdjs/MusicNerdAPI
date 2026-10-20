import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { db } from "@/lib/db/db";
import { users } from "@/lib/db/schema";
import { clearArtistLink } from "@/lib/artistLinks/clearArtistLink";

const bodySchema = z.object({
  artistId: z.string().uuid(),
  siteName: z.string().min(1).max(80),
});

/**
 * Removes an artist link. Admin-only: the caller must be an admin.
 *
 * @param request - The authenticated request with a JSON body.
 * @returns Success, or an error response.
 */
export async function postRemoveArtistDataHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid request body" },
      { status: 400, headers },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { status: "error", error: "artistId and siteName are required" },
      { status: 400, headers },
    );

  const { artistId, siteName } = parsed.data;

  // Admin-only gate
  const user = await db.query.users.findFirst({
    where: eq(users.id, auth.userId),
    columns: { isAdmin: true },
  });
  if (!user?.isAdmin)
    return NextResponse.json(
      { status: "error", error: "Unauthorized" },
      { status: 403, headers },
    );

  try {
    await clearArtistLink(artistId, siteName);
    return NextResponse.json({ status: "ok" }, { headers });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Column not in writable whitelist"))
      return NextResponse.json(
        { status: "error", error: "Invalid platform column" },
        { status: 400, headers },
      );
    console.error("[removeArtistData] Error:", error);
    return NextResponse.json(
      { status: "error", error: "Error removing artist data" },
      { status: 500, headers },
    );
  }
}
