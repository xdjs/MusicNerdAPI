import { isUnsafeUrl } from "@/lib/pages/isUnsafeUrl";
import type { PageContent } from "@/lib/pages/types";
import { canonicalizeLoreUrl } from "@/lib/sources/canonicalizeLoreUrl";
import { isBlockedSourceHost } from "@/lib/sources/isBlockedSourceHost";
import { isExcludedLoreDiscoveryUrl } from "@/lib/sources/isExcludedLoreDiscoveryUrl";

/** Validate fetch's final response URL before using it as source or page-ownership evidence. */
export function getFetchedSourceUrl(originalUrl: string, page: PageContent): string | null {
  const url = page.resolvedUrl ?? originalUrl;
  if (
    !canonicalizeLoreUrl(url) ||
    isUnsafeUrl(url) ||
    isBlockedSourceHost(url) ||
    isExcludedLoreDiscoveryUrl(url)
  )
    return null;
  if (url !== originalUrl)
    console.log("[vaultWebSearch] Resolved source URL:", originalUrl, "->", url);
  return url;
}
