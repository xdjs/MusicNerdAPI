import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_BIO_LENGTH } from "@/lib/bio/const";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const schema = z.object({
  bio: z
    .string()
    .max(MAX_BIO_LENGTH)
    .refine(bio => bio.trim().length > 0),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
});

/**
 * Validates the body of PUT /api/admin/bio-corrections/{id}/about: a
 * non-blank About of up to 10,000 characters and the 64-hex revision from the
 * read. MusicNerdWeb's checks and message.
 *
 * @param request - The request.
 * @returns `{ bio, revision }` with `bio` trimmed, or a 400 with CORS headers.
 */
export async function validateCorrectionAboutBody(
  request: Request,
): Promise<{ bio: string; revision: string } | NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (parsed.success) return { bio: parsed.data.bio.trim(), revision: parsed.data.revision };
  return NextResponse.json(
    { status: "error", error: "Enter a valid About and reload the editor if needed." },
    { status: 400, headers: getCorsHeaders() },
  );
}
