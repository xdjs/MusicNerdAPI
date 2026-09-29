import { isUnsafeUrl } from "@/lib/pages/isUnsafeUrl";
import { isGroundingRedirect } from "@/lib/sources/isGroundingRedirect";

/**
 * A Google grounding redirect resolved to its destination. Those tokens expire
 * and 404 within days, so one must never be stored. A no-op for any normal
 * URL; kept as the safety net if a provider ever returns redirect tokens.
 *
 * @param url - A candidate URL.
 * @returns The URL itself, the redirect's safe destination, or null when it can't be resolved.
 */
export async function resolveRedirectUrl(url: string): Promise<string | null> {
  if (!isGroundingRedirect(url)) return url;
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(5000) });
    if (res.url && !isGroundingRedirect(res.url) && !isUnsafeUrl(res.url)) return res.url;
  } catch {
    // An unresolvable redirect is not a source.
  }
  return null;
}
