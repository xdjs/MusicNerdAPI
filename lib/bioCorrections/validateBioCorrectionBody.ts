import { NextResponse } from "next/server";
import { z } from "zod";
import { BIO_CORRECTION_REASONS } from "@/lib/bioCorrections/const";
import type { BioCorrectionInput } from "@/lib/bioCorrections/types";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { normalizePublicUrl } from "@/lib/sources/normalizePublicUrl";

const bodySchema = z
  .object({
    reason: z.enum(BIO_CORRECTION_REASONS),
    expectedBio: z
      .string()
      .max(12000)
      .refine(bio => bio.trim().length > 0),
    details: z
      .string()
      .optional()
      .transform(details => (details ?? "").trim())
      .pipe(z.string().max(2000)),
    sourceUrl: z
      .string()
      .optional()
      .transform(url => (url ?? "").trim())
      .pipe(z.string().max(2048)),
  })
  .transform((input, ctx) => {
    const sourceUrl = input.sourceUrl ? normalizePublicUrl(input.sourceUrl) : null;
    const host = sourceUrl ? new URL(sourceUrl).hostname : "";
    if (
      (input.sourceUrl && !sourceUrl) ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
      /\.(local|internal|localhost)$/i.test(host)
    ) {
      ctx.addIssue({ code: "custom", message: "sourceUrl must be a public web page" });
      return z.NEVER;
    }
    return { ...input, sourceUrl };
  });

/**
 * Validates a report on an artist's About: a known reason, the About text the
 * reporter read, optional details (trimmed, at most 2,000 characters) and an
 * optional public source URL (a bare domain gets https://; IP addresses and
 * local hosts are refused).
 *
 * @param body - The parsed JSON body.
 * @returns The report, or a 400 with MusicNerdWeb's message.
 */
export function validateBioCorrectionBody(body: unknown): BioCorrectionInput | NextResponse {
  const parsed = bodySchema.safeParse(body);
  if (parsed.success) return parsed.data;
  return NextResponse.json(
    {
      status: "error",
      error: "Choose a reason and enter valid details or a public source URL",
    },
    { status: 400, headers: getCorsHeaders() },
  );
}
