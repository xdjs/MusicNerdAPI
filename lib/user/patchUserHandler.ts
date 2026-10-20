import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateUserName } from "@/lib/user/validateUserName";
import { db } from "@/lib/db/db";

export async function patchUserHandler(
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
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid request body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  const { username } = body;
  const trimmed = typeof username === "string" ? username.trim() : "";
  const invalid = validateUserName(username);
  if (invalid) {
    return NextResponse.json(
      { status: "error", error: invalid },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  try {
    const conflict = await db.execute(
      sql`SELECT id FROM users WHERE lower(username) = lower(${trimmed}) AND id != ${id}::uuid LIMIT 1`,
    );
    if (conflict.length) {
      return NextResponse.json(
        { status: "error", error: "That user name is already taken" },
        { status: 409, headers: getCorsHeaders() },
      );
    }
    await db.execute(
      sql`UPDATE users SET username = ${trimmed} WHERE id = ${id}::uuid`,
    );
    return NextResponse.json(
      { status: "ok", message: "User name updated" },
      { headers: getCorsHeaders() },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("email or wallet")
    ) {
      return NextResponse.json(
        { status: "error", error: error.message },
        { status: 400, headers: getCorsHeaders() },
      );
    }
    throw error;
  }
}
