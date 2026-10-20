import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSupabaseAdmin } from "@/lib/storage/getSupabaseAdmin";
import { db } from "@/lib/db/db";

const BUCKET = "user-profile-images";
const MAX_BYTES = 2 * 1024 * 1024;

export async function postUserProfileImageHandler(request: Request): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  if (Number(request.headers.get("content-length")) > MAX_BYTES + 65536) {
    return NextResponse.json(
      { status: "error", error: "Choose an image smaller than 2 MB" },
      { status: 413, headers: getCorsHeaders() },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > MAX_BYTES ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  ) {
    return NextResponse.json(
      { status: "error", error: "Choose a JPG, PNG or WebP image smaller than 2 MB" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  let output: Buffer;
  try {
    const input = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 20_000_000,
      animated: false,
    });
    const metadata = await input.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? ""))
      throw new Error("Unsupported image");
    output = await input
      .rotate()
      .resize(512, 512, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return NextResponse.json(
      { status: "error", error: "This image could not be read. Try another JPG, PNG or WebP." },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const ownerRows = await db.execute(
    sql`SELECT id, privy_user_id FROM users WHERE id = ${auth.userId}::uuid`,
  );
  const owner = ownerRows[0] as { id: string; privy_user_id: string | null } | undefined;
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
  const { error } = await storage.upload(`${folder}/avatar.webp`, output, {
    contentType: "image/webp",
    upsert: true,
    cacheControl: "0",
  });
  if (error) throw error;

  return NextResponse.json(
    { status: "ok" },
    { headers: { ...getCorsHeaders(), "Cache-Control": "private, no-store" } },
  );
}
