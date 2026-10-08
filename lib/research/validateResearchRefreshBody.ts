import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const schema = z.object({ mode: z.literal("lore-only").optional() });

/**
 * The existing empty-body Look again request keeps its social behavior. An
 * explicit Lore-only mode skips collection and reads only stored material.
 */
export async function validateResearchRefreshBody(
  request: Request,
): Promise<{ mode: "lore-only" } | null | NextResponse> {
  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid research refresh body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { status: "error", error: "Invalid research refresh body" },
      { status: 400, headers: getCorsHeaders() },
    );
  return parsed.data.mode ? { mode: "lore-only" } : null;
}
