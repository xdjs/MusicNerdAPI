import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const idSchema = z.uuid();

/**
 * Validates the path of POST /api/admin/mcp-keys/{id}/revoke. MusicNerdWeb
 * passed the id straight to Postgres and answered a non-UUID with a 500.
 *
 * @param id - The key id from the path.
 * @returns The id, or a 400 with `{ status: "error", error }` and CORS headers.
 */
export function validateMcpKeyId(id: string): string | NextResponse {
  if (idSchema.safeParse(id).success) return id;
  return NextResponse.json(
    { status: "error", error: "Invalid key ID" },
    { status: 400, headers: getCorsHeaders() },
  );
}
