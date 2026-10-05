import { titleMatchesArtist } from "@/lib/artists/titleMatchesArtist";
import { nameIsAmbiguousInDirectory } from "@/lib/identity/nameIsAmbiguousInDirectory";
import { fetchPageContent } from "@/lib/pages/fetchPageContent";
import { normalizeLoreDiscoveryUrl } from "@/lib/sources/normalizeLoreDiscoveryUrl";
import { VERIFY_TIMEOUT_MS } from "@/lib/vault/const";
import { insertVaultSource } from "@/lib/vault/insertVaultSource";
import { outOfBudget } from "@/lib/vault/outOfBudget";
import { recordSavedSource } from "@/lib/vault/recordSavedSource";
import type { SearchRun } from "@/lib/vault/types";
import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";

/** Retain catalog profiles from an already corroborated identity source, within the run's budget. */
export async function adoptMusicDestinations(
  run: SearchRun,
  urls: string[],
  evidence: "identifier" | "name" | "own-page",
): Promise<void> {
  if (evidence !== "identifier" && (await nameIsAmbiguousInDirectory(run.artistId, run.artistName)))
    return;
  const candidates = urls
    .map(url => parseMusicDestination(url))
    .filter(destination => destination?.kind === "artist");
  const ids = new Map<string, Set<string>>();
  for (const candidate of candidates) {
    if (!candidate) continue;
    const held = ids.get(candidate.platform) ?? new Set<string>();
    held.add(candidate.id);
    ids.set(candidate.platform, held);
  }
  const targets = candidates
    .filter(candidate => candidate && ids.get(candidate.platform)?.size === 1)
    .map(candidate => ({ url: candidate!.url, type: "music" }));
  for (const target of targets.slice(0, 9)) {
    if (outOfBudget(run, "catalog destination verification")) return;
    const key = normalizeLoreDiscoveryUrl(target.url);
    // The own-page pass may provide stronger evidence for a candidate the search
    // already read. The transactional writer still preserves all saved/rejected rows.
    if (evidence !== "own-page" && run.existingUrls.has(key)) continue;
    const page = await fetchPageContent(target.url, { timeoutMs: VERIFY_TIMEOUT_MS }).catch(
      () => null,
    );
    if (!page || page.status === null || page.status >= 400 || !page.title) continue;
    if (evidence !== "identifier" && !titleMatchesArtist(page.title, run.artistName)) continue;
    if (outOfBudget(run, "catalog destination insertion")) return;
    const source = await insertVaultSource({
      artistId: run.artistId,
      url: target.url,
      title: page.title,
      snippet: page.snippet,
      type: target.type,
      status: "pending",
      extractedText: page.extractedText,
      ogImage: page.ogImage,
    });
    run.existingUrls.add(key);
    if (source) recordSavedSource(run, source);
  }
}
