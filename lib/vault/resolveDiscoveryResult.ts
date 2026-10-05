import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";
import { inferTypeFromUrl } from "@/lib/sources/inferTypeFromUrl";
import type { DiscoveryResult } from "@/lib/vault/types";

/** Apply one URL-change classification policy before or after fetching, retaining spoken evidence. */
export function resolveDiscoveryResult(result: DiscoveryResult, url: string): DiscoveryResult {
  if (url === result.url) return result;
  const preserveType =
    result.type === "audio" ||
    result.type === "interview" ||
    (result.type === "website" && !parseMusicDestination(url));
  return { ...result, url, type: preserveType ? result.type : inferTypeFromUrl(url) };
}
