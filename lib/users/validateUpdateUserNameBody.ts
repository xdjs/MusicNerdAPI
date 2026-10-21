import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const bodySchema = z.record(z.string(), z.unknown());

/**
 * The PATCH /api/user/{id} body: a JSON object. `username` is returned as
 * sent; `validateUserName` decides whether it is acceptable.
 *
 * @param request - The request.
 * @returns `{ username }`, or a 400 response when the body is not a JSON object.
 */
export async function validateUpdateUserNameBody(
  request: Request,
): Promise<{ username: unknown } | NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = undefined;
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json(
      { status: "error", error: "Invalid request body" },
      { status: 400, headers: getCorsHeaders() },
    );
  return { username: parsed.data["username"] };
}
