import { z } from "zod";

/** A page number as MusicNerdWeb parsed it: `parseInt`, else the fallback. */
const positiveInt = (fallback: number) =>
  z
    .string()
    .nullable()
    .transform(value => {
      const parsed = parseInt(value ?? "", 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    });

/**
 * The leaderboard's query: an optional period, and pagination that MusicNerdWeb
 * switched on whenever `page` or `perPage` was sent, however malformed.
 * Nothing here is rejected, so no 400 is ever returned.
 *
 * @param searchParams - The request's query.
 * @returns The period bounds, page, page size and whether to paginate.
 */
export function validateLeaderboardQuery(searchParams: URLSearchParams) {
  const parsed = z
    .object({
      from: z.string().nullable(),
      to: z.string().nullable(),
      page: positiveInt(1),
      perPage: positiveInt(10),
    })
    .parse({
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      page: searchParams.get("page"),
      perPage: searchParams.get("perPage"),
    });
  return { ...parsed, isPaginated: searchParams.has("page") || searchParams.has("perPage") };
}
