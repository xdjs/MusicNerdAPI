import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Checks a bio-correction report id from the path is UUID-shaped.
 *
 * @param id - The id.
 * @returns The id, or a 400 response.
 */
export function validateReportId(id: string): string | NextResponse {
  if (/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return id;
  return NextResponse.json(
    { status: "error", error: "Invalid report ID" },
    { status: 400, headers: getCorsHeaders() },
  );
}
