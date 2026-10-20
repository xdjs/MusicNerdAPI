import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const bodySchema = z
  .object({
    claim: z.string().min(1).max(5000),
    correction: z.string().max(5000).nullable().optional(),
    kind: z.enum(["inaccurate", "outdated", "missing_context", "offensive", "other"]),
    expectedBio: z.string().max(15000).optional(),
  })
  .strict();

/**
 * Handles POST /api/artist/{id}/bio-corrections: a claimant or admin submits a
 * correction to the artist's generated biography.
 *
 * @param request - The request carrying the correction payload and bearer token.
 * @param id - The artist id from the path.
 * @returns 201 on success, or 400/401/403/413 with an error body.
 */
export async function postBioCorrectionsHandler(request: Request, id: string) {
  const headers = getCorsHeaders();

  const auth = await validateArtistEditRequest(request, id);
  if (auth instanceof NextResponse) return auth;

  const text = await request.text();
  if (text.length > 18000) {
    return NextResponse.json(
      { status: "error", error: "Payload too large" },
      { status: 413, headers },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400, headers });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", error: parsed.error.issues[0].message },
      { status: 400, headers },
    );
  }

  const { claim, correction, kind } = parsed.data;

  await db.execute(
    sql`INSERT INTO artist_doc_corrections (id, artist_id, claim, correction, kind)
        VALUES (gen_random_uuid(), ${auth.artistId}::uuid, ${claim}, ${correction ?? null}, ${kind})`,
  );

  return NextResponse.json({ status: "ok" }, { status: 201, headers });
}
