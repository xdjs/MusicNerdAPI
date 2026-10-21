import { z } from "zod";

/** The submitted-links query, normalized the way MusicNerdWeb's `/api/userEntries` read it. */
export type UserEntriesQuery = {
  /** From 1; anything that isn't a positive number is 1. */
  page: number;
  /** A platform to filter by; null for `all`, empty or absent. */
  siteName: string | null;
  /** True for `all=true`: every entry as one page. */
  all: boolean;
  /** `approved` or `pending`; null for both. */
  status: "approved" | "pending" | null;
  /** The artist-name search, trimmed and cut to 100 characters; undefined when empty. */
  query: string | undefined;
  order: "oldest" | "newest";
};

const schema = z.object({
  page: z
    .string()
    .optional()
    .transform(value => {
      const page = parseInt(value ?? "1", 10);
      return Number.isFinite(page) && page > 0 ? page : 1;
    }),
  siteName: z
    .string()
    .optional()
    .transform(value => (value && value !== "all" ? value : null)),
  all: z
    .string()
    .optional()
    .transform(value => value === "true"),
  status: z
    .string()
    .optional()
    .transform(value => (value === "approved" || value === "pending" ? value : null)),
  query: z
    .string()
    .optional()
    .transform(value => value?.trim().slice(0, 100) || undefined),
  order: z
    .string()
    .optional()
    .transform(value => (value === "oldest" ? "oldest" : "newest")),
});

/**
 * The submitted-links query. Every parameter is optional and a bad value
 * falls back to its default, as on MusicNerdWeb, so this never rejects.
 *
 * @param request - The request.
 * @returns The normalized query.
 */
export function validateUserEntriesQuery(request: Request): UserEntriesQuery {
  const params = new URL(request.url).searchParams;
  return schema.parse({
    page: params.get("page") ?? undefined,
    siteName: params.get("siteName") ?? undefined,
    all: params.get("all") ?? undefined,
    status: params.get("status") ?? undefined,
    query: params.get("query") ?? undefined,
    order: params.get("order") ?? undefined,
  });
}
