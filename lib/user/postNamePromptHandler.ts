import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { db } from "@/lib/db/db";

export async function postNamePromptHandler(request: Request, id: string): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.userId !== id) {
    return NextResponse.json(
      { status: "error", error: "Forbidden" },
      { status: 403, headers: getCorsHeaders() },
    );
  }
  const rows = await db.execute(
    sql`UPDATE users SET username_prompted_at = now()
        WHERE id = ${id}::uuid
          AND username_needs_confirmation = true
          AND username_prompted_at IS NULL
        RETURNING id`,
  );
  return NextResponse.json(
    { status: "ok", showPrompt: rows.length > 0 },
    { headers: getCorsHeaders() },
  );
}
