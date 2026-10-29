import type { ReviewQueueQuery } from "@/lib/adminReview/types";
import { readPage } from "@/lib/db/readPage";

const TYPES = ["links", "sources", "corrections"] as const;

/**
 * Reads the query of GET /api/admin/review-queue the way MusicNerdWeb's admin
 * page read its search params: an unknown `type` is every type, a `page` that
 * isn't a number is page 1, and `query` is trimmed to 100 characters.
 *
 * @param request - The request.
 * @returns The filters; never an error.
 */
export function validateReviewQueueQuery(request: Request): ReviewQueueQuery {
  const params = new URL(request.url).searchParams;
  const type = params.get("type") ?? "";
  return {
    type: (TYPES as readonly string[]).includes(type) ? (type as ReviewQueueQuery["type"]) : "all",
    query: (params.get("query") ?? "").trim().slice(0, 100),
    page: readPage(params),
  };
}
