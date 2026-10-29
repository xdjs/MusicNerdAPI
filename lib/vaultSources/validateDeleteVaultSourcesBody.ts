import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const bodySchema = z.object({ sourceIds: z.array(z.uuid()).min(1).max(200) });

/**
 * Validates a bulk source removal: 1 to 200 source ids.
 *
 * @param body - The parsed JSON body, or null when it wasn't JSON.
 * @returns `{ sourceIds }`, or a 400.
 */
export function validateDeleteVaultSourcesBody(
  body: unknown,
): { sourceIds: string[] } | NextResponse {
  const parsed = bodySchema.safeParse(body);
  if (parsed.success) return parsed.data;
  return NextResponse.json(
    { status: "error", error: "sourceIds must be 1 to 200 source IDs" },
    { status: 400, headers: getCorsHeaders() },
  );
}
