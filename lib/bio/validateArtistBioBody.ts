import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_BIO_LENGTH } from "@/lib/bio/const";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const bodySchema = z.object({ bio: z.unknown(), regenerate: z.unknown() }).partial();
const bioSchema = z
  .string({ error: "Invalid bio" })
  .refine(bio => bio.trim().length > 0, "Invalid bio")
  .refine(bio => bio.length <= MAX_BIO_LENGTH, `Bio must be ${MAX_BIO_LENGTH} characters or fewer`);

/**
 * Validates the body of PUT /api/artistBio/{id}: a non-blank `bio` of at most
 * MAX_BIO_LENGTH characters, unless `regenerate` is truthy, when `bio` is ignored.
 *
 * @param body - The parsed JSON body.
 * @returns `{ bio }` or `{ regenerate: true }`, or a 400 with MusicNerdWeb's message.
 */
export function validateArtistBioBody(
  body: unknown,
): { bio?: string; regenerate: boolean } | NextResponse {
  const fail = (error: string) =>
    NextResponse.json({ status: "error", error }, { status: 400, headers: getCorsHeaders() });
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail("Invalid bio");
  if (parsed.data.regenerate) return { regenerate: true };
  const bio = bioSchema.safeParse(parsed.data.bio);
  if (!bio.success) return fail(bio.error.issues[0].message);
  return { bio: bio.data, regenerate: false };
}
