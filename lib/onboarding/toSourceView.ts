import type { SourceView } from "@/lib/onboarding/types";

/**
 * A saved source cut down to what the research view shows, so its text and
 * verification record never travel to the browser.
 *
 * @param source - A saved vault source.
 * @param source.url - Its URL.
 * @param source.title - Its title, if any.
 * @param source.ogImage - Its share image, if any.
 * @returns The title, URL and share image.
 */
export function toSourceView(source: {
  url: string;
  title?: string | null;
  ogImage?: string | null;
}): SourceView {
  return { title: source.title ?? null, url: source.url, ogImage: source.ogImage ?? null };
}
