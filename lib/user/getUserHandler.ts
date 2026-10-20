import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { db } from "@/lib/db/db";

export async function getUserHandler(
  request: Request,
  id: string,
): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.userId !== id) {
    return NextResponse.json(
      { status: "error", error: "Forbidden" },
      { status: 403, headers: getCorsHeaders() },
    );
  }
  const rows = await db.execute(
    sql`SELECT id, username, email, wallet, is_admin, is_hidden, is_white_listed, privy_user_id FROM users WHERE id = ${id}::uuid`,
  );
  if (!rows.length) {
    return NextResponse.json(
      { status: "error", error: "User not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }
  return NextResponse.json(rows[0], { headers: getCorsHeaders() });
}
