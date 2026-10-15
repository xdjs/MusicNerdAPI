import { researchPlatformForUrl } from "./researchPlatformForUrl";
import type { ResearchOriginal } from "./types";

/** Interleave an already chronological public corpus without changing order within a provider. */
export function diversifyResearchOriginals(chronological: ResearchOriginal[]): ResearchOriginal[] {
  const groups = new Map<string, ResearchOriginal[]>();
  for (const source of chronological) {
    const provider = researchPlatformForUrl(source.url) ?? new URL(source.url).hostname;
    const group = groups.get(provider) ?? [];
    group.push(source);
    groups.set(provider, group);
  }
  const diverse: ResearchOriginal[] = [];
  for (let index = 0; diverse.length < chronological.length; index++)
    for (const group of groups.values()) if (group[index]) diverse.push(group[index]);
  return diverse;
}
