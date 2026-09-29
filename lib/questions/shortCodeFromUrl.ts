import { slug } from "@/lib/questions/slug";

/**
 * The Instagram shortcode of a `/p/<code>/` url: a stable id for a post that
 * no re-scrape can change.
 *
 * @param url - A post url.
 * @returns The shortcode, or a slug of the url when it has none.
 */
export function shortCodeFromUrl(url: string): string {
  const m = url.match(/\/p\/([^/]+)\/?/);
  return m ? m[1] : slug(url);
}
