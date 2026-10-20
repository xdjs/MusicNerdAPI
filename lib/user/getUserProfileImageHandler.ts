import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSupabaseAdmin } from "@/lib/storage/getSupabaseAdmin";
import { db } from "@/lib/db/db";

const BUCKET = "user-profile-images";

export async function getUserProfileImageHandler(
  request: Request,
): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const ownerRows = await db.execute(
    sql`SELECT id, privy_user_id FROM users WHERE id = ${auth.userId}::uuid`,
  );
  const owner = ownerRows[0] as
    | { id: string; privy_user_id: string | null }
    | undefined;
  if (!owner) {
    return NextResponse.json(
      { status: "error", error: "Account not found" },
      { status: 401, headers: getCorsHeaders() },
    );
  }

  const expected = request.headers.get("X-Profile-Account");
  if (expected && expected !== owner.id) {
    return NextResponse.json(
      { status: "error", error: "Your account changed. Refresh and try again." },
      { status: 409, headers: getCorsHeaders() },
    );
  }

  const folder = owner.privy_user_id
    ? `identity-${createHash("sha256").update(owner.privy_user_id).digest("hex")}`
    : owner.id;

  const storage = getSupabaseAdmin().storage.from(BUCKET);
  let photoFolder: string | null = null;
  for (const candidate of [...new Set([folder, owner.id])]) {
    const { data: files, error: listError } = await storage.list(candidate, {
      limit: 1,
      search: "avatar.webp",
    });
    if (listError) throw listError;
    if (files?.some((file) => file.name === "avatar.webp")) {
      photoFolder = candidate;
      break;
    }
  }

  if (!photoFolder) {
    return NextResponse.json(
      { userId: owner.id, url: null },
      { headers: { ...getCorsHeaders(), "Cache-Control": "private, no-store" } },
    );
  }

  const { data, error } = await storage.createSignedUrl(
    `${photoFolder}/avatar.webp`,
    3600,
  );
  if (error) throw error;
  return NextResponse.json(
    { userId: owner.id, url: `${data.signedUrl}&v=${Date.now()}` },
    { headers: { ...getCorsHeaders(), "Cache-Control": "private, no-store" } },
  );
}
