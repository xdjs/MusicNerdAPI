import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { db } from "@/lib/db/db";
import { artistVaultSources } from "@/lib/db/schema";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const bodySchema = z
  .object({
    url: z.string().url().max(2048),
    title: z.string().max(500).optional(),
  })
  .strict();

/**
 * Handles POST /api/artist/{id}/lore-suggestions: a signed-in user suggests a
 * source URL for the artist's vault.
 *
 * @param request - The authenticated request carrying the suggestion payload.
 * @param id - The artist id from the path.
 * @returns 201 on success, 409 if the source already exists, or 400/401.
 */
export async function postLoreSuggestionsHandler(request: Request, id: string) {
  const headers = getCorsHeaders();

  const idResult = z.string().uuid().safeParse(id);
  if (!idResult.success) {
    return NextResponse.json(
      { status: "error", error: "Invalid artist id" },
      { status: 400, headers },
    );
  }

  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON" },
      { status: 400, headers },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", error: parsed.error.issues[0].message },
      { status: 400, headers },
    );
  }

  const { url, title } = parsed.data;

  const existing = await db.query.artistVaultSources.findFirst({
    where: and(eq(artistVaultSources.artistId, id), eq(artistVaultSources.url, url)),
    columns: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      { status: "error", error: "Source already exists" },
      { status: 409, headers },
    );
  }

  await db.insert(artistVaultSources).values({
    artistId: id,
    url,
    title: title ?? null,
    origin: "user_suggestion",
    status: "pending",
  });

  return NextResponse.json({ status: "ok" }, { status: 201, headers });
}
