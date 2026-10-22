import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { MAX_VAULT_FILE_BYTES, VAULT_UPLOAD_LIMIT_LABEL } from "@/lib/vaultUpload/const";

const schema = z.object({
  artistId: z.string().regex(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i),
  name: z
    .string()
    .max(255)
    .refine(name => name.trim().length > 0),
  type: z.string(),
  size: z.int().min(1).max(MAX_VAULT_FILE_BYTES),
});

/**
 * The sign request: the artist, and the file's name, declared type and size.
 * Any problem gets MusicNerdWeb's one message, since the size is what a
 * person can act on.
 *
 * @param request - The request with a JSON body.
 * @returns The parsed body, or a 400 with CORS headers.
 */
export async function validateSignUploadBody(
  request: Request,
): Promise<z.infer<typeof schema> | NextResponse> {
  const reject = () =>
    NextResponse.json(
      { status: "error", error: `Choose a file up to ${VAULT_UPLOAD_LIMIT_LABEL}.` },
      { status: 400, headers: getCorsHeaders() },
    );
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reject();
  }
  const parsed = schema.safeParse(body);
  return parsed.success ? parsed.data : reject();
}
