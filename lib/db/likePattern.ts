/**
 * A case-insensitive "contains" pattern for `ilike`: the search with LIKE's
 * wildcards (`%`, `_`) and its escape character taken literally.
 *
 * @param search - What the caller typed.
 * @returns `%<escaped search>%`.
 */
export function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, "\\$&")}%`;
}
