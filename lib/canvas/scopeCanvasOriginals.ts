import type { CanvasResearchOriginal } from "./const";
import { getCanvasSourceContent } from "./getCanvasSourceContent";
import { hasCanvasTopicEvidence } from "./hasCanvasTopicEvidence";
/** Keep the existing retrieval engine, but prevent cross-album navigation and unrelated equipment candidates entering it. */
export function scopeCanvasOriginals(
  originals: CanvasResearchOriginal[],
  query: string,
): CanvasResearchOriginal[] {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const question = ` ${normalize(query)} `;
  const content = originals.map(source => ({ source, ...getCanvasSourceContent(source) }));
  const namedAlbums = content
    .filter(c => c.album)
    .filter(c => {
      const words = normalize(c.title).split(" ");
      const prefix = words.slice(0, Math.min(3, words.length)).join(" ");
      return prefix.length >= 5 && question.includes(` ${prefix} `);
    })
    .map(c => normalize(c.title));
  return content
    .filter(c => !c.album || !namedAlbums.length || namedAlbums.includes(normalize(c.title)))
    .filter(c => hasCanvasTopicEvidence(query, c.text))
    .map(c => ({ ...c.source, text: c.text }));
}
