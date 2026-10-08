import { accountMatchFor } from "@/lib/vault/accountMatchFor";
import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";
import type { DiscoveryOriginal } from "@/lib/questionResearch/types";
/** Classify a fetched account as a reviewable Link; this path never invokes account adoption. */
export async function classifyQuestionOriginal(
  original: DiscoveryOriginal,
): Promise<DiscoveryOriginal> {
  if (parseMusicDestination(original.url)?.kind === "release") return original;
  const { match, isAccountUrl } = await accountMatchFor(original.url);
  return isAccountUrl && match?.siteName && match.id
    ? { ...original, destination: "link", platform: match.siteName, platformId: String(match.id) }
    : original;
}
