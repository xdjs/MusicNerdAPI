import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const schema = z.object({ label: z.string().trim().min(1) });

/**
 * Validates the body of POST /api/admin/mcp-keys: a non-blank `label`.
 *
 * @param request - The request.
 * @returns `{ label }` trimmed, or a 400 with MusicNerdWeb's "Label is required".
 */
export async function validateMcpKeyBody(
  request: Request,
): Promise<{ label: string } | NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (parsed.success) return { label: parsed.data.label };
  return NextResponse.json(
    { status: "error", error: "Label is required" },
    { status: 400, headers: getCorsHeaders() },
  );
}
