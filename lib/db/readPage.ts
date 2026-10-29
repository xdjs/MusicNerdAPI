/**
 * The `page` of a paged list's query: a positive integer, or 1 for anything
 * else, as MusicNerdWeb's admin pages read it.
 *
 * @param params - The request's search params.
 * @returns The page, from 1.
 */
export function readPage(params: URLSearchParams): number {
  const page = Number(params.get("page") || 1);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}
