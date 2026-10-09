import type { ResearchRequest } from "@/lib/questionResearch/types";

/** Match exact public provider hosts; lookalike domains cannot satisfy a source constraint. */
export function researchPlatformForUrl(url: string): ResearchRequest["platform"] {
  const host = new URL(url).hostname.replace(/^www\./, "");
  const hosts: Record<string, ResearchRequest["platform"]> = {
    "instagram.com": "instagram",
    "tiktok.com": "tiktok",
    "x.com": "x",
    "twitter.com": "x",
    "inprocess.world": "inprocess",
    "open.spotify.com": "spotify",
    "spotify.com": "spotify",
    "deezer.com": "deezer",
  };
  return hosts[host];
}
