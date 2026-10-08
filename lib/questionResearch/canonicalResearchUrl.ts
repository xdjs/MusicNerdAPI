import { validateResearchUrl } from "@/lib/questionResearch/validateResearchUrl";
/** Dedupe tracking/host aliases without lowercasing case-sensitive post or document paths. */
export function canonicalResearchUrl(value: string): string {
  const u = new URL(validateResearchUrl(value));
  u.hostname = u.hostname.replace(/^www\./, "").replace(/^twitter\.com$/, "x.com");
  u.pathname = u.pathname.replace(/\/+$/, "") || "/";
  for (const key of [...u.searchParams.keys()])
    if (/^utm_|^(?:fbclid|gclid|igsh|igshid|s|t)$/i.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  return u.href;
}
