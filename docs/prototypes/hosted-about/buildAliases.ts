import { fileURLToPath } from "node:url";

/** Explicit aliases for a separately reviewed isolated build; never installed by production config. */
export function buildAliases() {
  const path = (name: string) => fileURLToPath(new URL(`./${name}.ts`, import.meta.url));
  return {
    "@/lib/lore/synthesizeArtistDoc": path("synthesizeArtistDoc"),
    "@/lib/lore/generateAboutFromDoc": path("generateAboutFromDoc"),
    "@/lib/lore/generateLoreSummary": path("generateLoreSummary"),
    "@/lib/ai/generateText": path("generateText"),
    "@/lib/ai/streamText": path("streamText"),
    "@/lib/ai/generateObject": path("generateObject"),
    "@/lib/ai/generateArray": path("generateArray"),
  };
}
