import { NextResponse } from "next/server";
import { z } from "zod";
import type { UserRole } from "@/lib/adminUsers/types";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const schema = z.object({
  userIds: z.array(z.uuid()).min(1),
  role: z.enum(["whitelisted", "admin", "hidden"]),
  enabled: z.boolean(),
});

/**
 * Validates the body of PATCH /api/admin/users: user ids, a role and whether
 * to turn it on.
 *
 * @param request - The request.
 * @returns `{ userIds, role, enabled }`, or a 400 with `{ status: "error", error }`.
 */
export async function validateUserRoleBody(
  request: Request,
): Promise<{ userIds: string[]; role: UserRole; enabled: boolean } | NextResponse> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (parsed.success) return parsed.data;
  return NextResponse.json(
    { status: "error", error: "Invalid role change" },
    { status: 400, headers: getCorsHeaders() },
  );
}
