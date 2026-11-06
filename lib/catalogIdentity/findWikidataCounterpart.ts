import {
  WIKIDATA_ENDPOINT,
  WIKIDATA_PLATFORM_PROPERTY,
  WIKIDATA_TIMEOUT_MS,
  WIKIDATA_USER_AGENT,
} from "@/lib/catalogIdentity/const";
import { isCatalogPlatformId } from "@/lib/catalogIdentity/isCatalogPlatformId";
import type { WikidataLookupResult } from "@/lib/catalogIdentity/types";
import type { MusicPlatform } from "@/lib/musicPlatform/types";

type Binding = {
  item?: { value?: string };
  targetId?: { value?: string };
  otherTarget?: { value?: string };
};

const entityId = (value: string) =>
  /^https?:\/\/www\.wikidata\.org\/entity\/(Q\d+)$/.exec(value)?.[1] ?? null;

/**
 * The other platform's artist id from Wikidata: the one entity holding the
 * source id must hold exactly one target id, and no other entity may hold it.
 *
 * @param sourcePlatform - The submitted platform.
 * @param sourcePlatformId - The submitted id.
 * @param targetPlatform - The other platform.
 * @returns A match, a miss or ambiguous. Throws on a failed or malformed response, so the caller can tell an outage from a miss.
 */
export async function findWikidataCounterpart(
  sourcePlatform: MusicPlatform,
  sourcePlatformId: string,
  targetPlatform: MusicPlatform,
): Promise<WikidataLookupResult> {
  if (!isCatalogPlatformId(sourcePlatform, sourcePlatformId)) return { status: "miss" };
  const source = WIKIDATA_PLATFORM_PROPERTY[sourcePlatform];
  const target = WIKIDATA_PLATFORM_PROPERTY[targetPlatform];
  const sparql = `
SELECT ?item ?targetId ?otherTarget WHERE {
  ?item wdt:${source} "${sourcePlatformId}" .
  OPTIONAL {
    ?item wdt:${target} ?targetId .
    OPTIONAL {
      ?otherTarget wdt:${target} ?targetId .
      FILTER (?otherTarget != ?item)
    }
  }
}
LIMIT 10`;
  const response = await fetch(WIKIDATA_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": WIKIDATA_USER_AGENT,
    },
    body: `query=${encodeURIComponent(sparql)}`,
    signal: AbortSignal.timeout(WIKIDATA_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Wikidata SPARQL returned ${response.status}`);
  const data = (await response.json()) as { results?: { bindings?: Binding[] } };
  const bindings = data?.results?.bindings;
  if (!Array.isArray(bindings)) throw new Error("Wikidata SPARQL returned a malformed response");
  if (bindings.length === 0) return { status: "miss" };

  const malformed = () => new Error("Wikidata SPARQL returned a malformed binding");
  const entities = new Set<string>();
  const targets = new Set<string>();
  let ownedElsewhere = false;
  let unbound = false;
  for (const binding of bindings) {
    const item = typeof binding?.item?.value === "string" ? entityId(binding.item.value) : null;
    if (!item) throw malformed();
    entities.add(item);
    if (binding.targetId === undefined) {
      if (binding.otherTarget !== undefined) throw malformed();
      unbound = true;
      continue;
    }
    const targetId =
      typeof binding.targetId?.value === "string" ? binding.targetId.value.trim() : "";
    if (!targetId || !isCatalogPlatformId(targetPlatform, targetId)) throw malformed();
    targets.add(targetId);
    if (binding.otherTarget !== undefined) {
      const other = binding.otherTarget?.value;
      if (typeof other !== "string" || !entityId(other)) throw malformed();
      ownedElsewhere = true;
    }
  }
  if (unbound && targets.size > 0)
    throw new Error("Wikidata SPARQL returned inconsistent bindings");
  if (entities.size !== 1 || targets.size > 1 || ownedElsewhere) return { status: "ambiguous" };
  if (targets.size === 0) return { status: "miss" };
  return { status: "match", platformId: [...targets][0], wikidataId: [...entities][0] };
}
