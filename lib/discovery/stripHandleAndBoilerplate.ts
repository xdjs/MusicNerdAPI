import type { ProfileDisplayColumn } from "@/lib/links/types";
import { TITLE_BOILERPLATE_FRAGMENTS } from "@/lib/discovery/const";
import { escapeRegExp } from "@/lib/text/escapeRegExp";

/**
 * What's left of an og:title once the probed handle and platform boilerplate
 * are removed: the only text the name check may treat as evidence. The handle
 * is nearly always echoed in the title, so checking the raw title would match
 * a stranger's page on the handle we guessed.
 *
 * @param title - The og:title.
 * @param handle - The probed handle.
 * @param platform - Known platform; X suffix normalization is opt-in for X candidates.
 * @returns The residual name text, trimmed; possibly empty.
 */
export function stripHandleAndBoilerplate(
  title: string,
  handle: string,
  platform?: ProfileDisplayColumn,
): string {
  let s = platform === "x" ? title.replace(/\s+-\s*X\s*$/i, "") : title;
  if (handle) {
    const esc = escapeRegExp(handle);
    s = s.replace(new RegExp(`\\(\\s*@${esc}\\s*\\)`, "gi"), " ");
    s = s.replace(new RegExp(`@${esc}\\b`, "gi"), " ");
    s = s.replace(new RegExp(`\\b${esc}\\b`, "gi"), " ");
  }
  for (const fragment of TITLE_BOILERPLATE_FRAGMENTS) s = s.replace(fragment, " ");
  return s.replace(/\s+/g, " ").trim();
}
