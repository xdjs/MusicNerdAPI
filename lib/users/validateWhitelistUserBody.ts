import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import type { WhitelistedUserUpdate } from "@/lib/users/updateWhitelistedUser";

const schema = z.object({
  wallet: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  username: z.string().optional(),
  isAdmin: z.boolean().optional(),
  isWhiteListed: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

/**
 * Validates the body of PUT /api/admin/whitelist-user/{id}: the fields
 * MusicNerdWeb's route read, each optional, with `null` allowed for `wallet`
 * and `email`. Other keys are ignored. Whether a user name is acceptable is
 * decided by the update itself.
 *
 * @param request - The request.
 * @returns The fields to change, or a 400 with `{ status: "error", error }` and CORS headers.
 */
export async function validateWhitelistUserBody(
  request: Request,
): Promise<WhitelistedUserUpdate | NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  return NextResponse.json(
    { status: "error", error: "Invalid whitelist user body" },
    { status: 400, headers: getCorsHeaders() },
  );
}
