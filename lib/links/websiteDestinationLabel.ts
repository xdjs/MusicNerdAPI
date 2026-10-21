/**
 * A website link's label, distinguishing part first so separate pages stay
 * recognizable in narrow grids.
 *
 * @param href - The page's URL.
 * @returns "path · host", or the host alone for a home page.
 */
export function websiteDestinationLabel(href: string): string {
  const url = new URL(href);
  const host = url.host.replace(/^www\./, "");
  const page = `${url.pathname === "/" ? "" : url.pathname}${url.search}${url.hash}`;
  return page ? `${page} · ${host}` : host;
}
