import { z } from "zod";

const schema = z.object({
  userId: z.string().optional(),
});

/**
 * The recently-edited query: an optional `userId`. Empty means "the signed-in
 * user", as on MusicNerdWeb, which never rejected this query.
 *
 * @param request - The request.
 * @returns `{ userId }`, null when absent or empty.
 */
export function validateRecentEditedQuery(request: Request): { userId: string | null } {
  const { userId } = schema.parse({
    userId: new URL(request.url).searchParams.get("userId") ?? undefined,
  });
  return { userId: userId || null };
}
