/**
 * The page to answer for a paged list: the last page for one past the end.
 *
 * @param page - The requested page, from 1.
 * @param total - Matches across every page.
 * @param pageSize - Rows per page.
 * @returns A page from 1 to the last.
 */
export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
}
