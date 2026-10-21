import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const schema = z.object({ ticket: z.string() });

/**
 * The complete request: the ticket from `sign`. A missing ticket is reported
 * the same way as a forged one.
 *
 * @param request - The request with a JSON body.
 * @returns `{ ticket }`, or a 400 with CORS headers.
 */
export async function validateCompleteUploadBody(
  request: Request,
): Promise<{ ticket: string } | NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  return NextResponse.json(
    { status: "error", error: "Upload expired or invalid. Please try again." },
    { status: 400, headers: getCorsHeaders() },
  );
}
