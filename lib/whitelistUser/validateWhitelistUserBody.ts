import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const bodySchema = z.object({
  wallet: z.string().optional(),
  email: z.string().optional(),
  username: z.string().optional(),
  isAdmin: z.boolean().optional(),
  isWhiteListed: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

export type WhitelistUserBody = z.infer<typeof bodySchema>;

/**
 * Reads PUT /api/admin/whitelist-user/{id}'s body: the fields an admin may change.
 *
 * @param request - The incoming request.
 * @returns The parsed fields, or a 400 when the body isn't JSON or a field has the wrong type.
 */
export async function validateWhitelistUserBody(
  request: Request,
): Promise<WhitelistUserBody | NextResponse> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (parsed.success) return parsed.data;
  return NextResponse.json(
    { status: "error", error: "Invalid user fields" },
    { status: 400, headers: getCorsHeaders() },
  );
}
