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
  if (await nameIsAmbiguousInDirectory(run.artistId, run.artistName)) return;
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
  const seen = new Set<string>();
  const targets = candidates
    .filter(candidate => {
      if (!candidate || ids.get(candidate.platform)?.size !== 1) return false;
      const identity = `${candidate.platform}:${candidate.id}`;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    })
    .map(candidate => ({ url: candidate!.url, type: "music" }));
  const fresh = targets.filter(
    target => !run.existingUrls.has(normalizeLoreDiscoveryUrl(target.url)),
  );
  // A corroborated own page can strengthen an earlier search candidate. Revisit
  // those only after new targets, within the same nine-fetch ceiling.
  const revisits =
    evidence === "own-page"
      ? targets.filter(target => run.existingUrls.has(normalizeLoreDiscoveryUrl(target.url)))
      : [];
  for (const target of [...fresh, ...revisits].slice(0, 9)) {
    if (outOfBudget(run, "catalog destination verification")) return;
    const key = normalizeLoreDiscoveryUrl(target.url);
    const page = await fetchPageContent(target.url, { timeoutMs: VERIFY_TIMEOUT_MS }).catch(
      () => null,
    );
    if (!page || page.status === null || page.status >= 400 || !page.title) continue;
    // Matching one MusicBrainz identifier is not proof for its other relations.
    if (!titleMatchesArtist(page.title, run.artistName)) continue;
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
