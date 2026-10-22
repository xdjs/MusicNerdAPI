import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/** MusicNerdWeb's report id check: a UUID, any case. */
const validId = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/**
 * Validates the path of the `/api/admin/bio-corrections/{id}` routes.
 *
 * @param id - The report id from the path.
 * @returns The id, or a 400 with MusicNerdWeb's "Invalid report ID" and CORS headers.
 */
export function validateReportId(id: string): string | NextResponse {
  if (validId.test(id)) return id;
  return NextResponse.json(
    { status: "error", error: "Invalid report ID" },
    { status: 400, headers: getCorsHeaders() },
  );
}
