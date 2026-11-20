import { NextResponse } from "next/server";
import { z } from "zod";
import { toAgentName } from "@/lib/board/toAgentName";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const schema = z.object({ agent: z.string() });

/**
 * Validates the body of POST /api/board/keys: an `agent` name with something usable in it.
 *
 * @param request - The request.
 * @returns `{ agent }`, cleaned by `toAgentName`, or a 400.
 */
export async function validateBoardKeyBody(
  request: Request,
): Promise<{ agent: string } | NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  const agent = parsed.success ? toAgentName(parsed.data.agent) : null;
  if (agent) return { agent };
  return NextResponse.json(
    { status: "error", error: "Agent name is required" },
    { status: 400, headers: getCorsHeaders() },
  );
}
