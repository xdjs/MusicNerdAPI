import type { MusicPlatform } from "@/lib/musicPlatform/types";

export const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
export const WIKIDATA_TIMEOUT_MS = 4_000;
/** Wikidata asks for a contactable agent. */
export const WIKIDATA_USER_AGENT = "MusicNerd/1.0 (https://musicnerd.xyz)";
/** The Wikidata properties holding each platform's artist id. */
export const WIKIDATA_PLATFORM_PROPERTY: Record<MusicPlatform, string> = {
  spotify: "P1902",
  deezer: "P2722",
};
/** How long the counterpart's own platform may take to confirm it. */
export const PROVIDER_VERIFICATION_TIMEOUT_MS = 5_000;
