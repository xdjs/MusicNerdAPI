import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { MAX_TURN_ARRAY_LEN } from "@/lib/onboarding/const";
import type { ClientTurn } from "@/lib/onboarding/types";

const turnSchema = z.looseObject({
  type: z.string(),
  decisions: z.array(z.unknown()).max(MAX_TURN_ARRAY_LEN).optional(),
  addedLinks: z.array(z.unknown()).max(MAX_TURN_ARRAY_LEN).optional(),
  addedUrls: z.array(z.unknown()).max(MAX_TURN_ARRAY_LEN).optional(),
});

/**
 * Checks a chat turn's body. Only the shape the route relies on is checked
 * here (a string `type`, and no client array over 100 items, rejected before it
 * reaches a handler loop); each handler validates the fields it reads.
 * MusicNerdWeb's messages, which `useOnboardingChat` shows.
 *
 * @param request - The request.
 * @returns The turn, or a 400: "Invalid body", "Invalid turn" or "Too many items in one turn".
 */
export async function validateOnboardingTurnBody(
  request: Request,
): Promise<ClientTurn | NextResponse> {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = body === undefined ? undefined : turnSchema.safeParse(body);
  if (parsed?.success) return body as ClientTurn;
  const error = !parsed
    ? "Invalid body"
    : parsed.error.issues.some(i => i.code === "too_big")
      ? "Too many items in one turn"
      : "Invalid turn";
  return NextResponse.json({ status: "error", error }, { status: 400, headers: getCorsHeaders() });
}
