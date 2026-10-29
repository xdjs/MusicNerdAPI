import { NextResponse } from "next/server";
import { z } from "zod";
import type { AdminContributionsQuery } from "@/lib/adminContributions/types";
import { readPage } from "@/lib/db/readPage";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const uuid = z.uuid();
const pick = (value: string | null, allowed: string[]) =>
  allowed.includes(value ?? "") ? value! : "";

/**
 * Reads the query of GET /api/admin/contributions the way MusicNerdWeb's
 * contributions page read its search params: unknown `origin`, `type` and
 * `status` values are dropped, `status` defaults to `all` for one contributor
 * and `pending` otherwise, and a bad `page` is page 1.
 *
 * @param request - The request.
 * @returns The filters, or a 400 with `{ status: "error", error }` when `userId` isn't a UUID.
 */
export function validateAdminContributionsQuery(
  request: Request,
): AdminContributionsQuery | NextResponse {
  const params = new URL(request.url).searchParams;
  const userId = params.get("userId") ?? "";
  if (userId && !uuid.safeParse(userId).success)
    return NextResponse.json(
      { status: "error", error: "Invalid user ID" },
      { status: 400, headers: getCorsHeaders() },
    );
  return {
    userId,
    query: (params.get("query") ?? "").trim().slice(0, 100),
    origin: pick(params.get("origin"), ["user", "research", "unknown"]),
    type: pick(params.get("type"), ["link", "lore", "upload"]),
    status:
      pick(params.get("status"), ["all", "pending", "approved", "rejected"]) ||
      (userId ? "all" : "pending"),
    page: readPage(params),
  };
}
