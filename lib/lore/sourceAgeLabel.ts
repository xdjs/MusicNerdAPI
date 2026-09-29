/**
 * How a source's age is described to the model: "published 2019-01-10, 7 years ago".
 * An undated source says so, so the model can tell "we know this is old" from
 * "we do not know how old this is".
 *
 * @param publishedAt - The source's publication date, if it gives one.
 * @param now - The current time, for tests.
 * @returns The label.
 */
export function sourceAgeLabel(
  publishedAt: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!publishedAt) return "date unknown";
  const then = new Date(publishedAt);
  if (isNaN(then.getTime())) return "date unknown";
  const years = (now.getTime() - then.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (years < 0) return `published ${publishedAt}`;
  if (years < 1) return `published ${publishedAt}, within the last year`;
  const rounded = Math.round(years);
  return `published ${publishedAt}, ${rounded} year${rounded === 1 ? "" : "s"} ago`;
}
