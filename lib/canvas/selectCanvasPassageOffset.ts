/** Choose a short exact passage by question coverage; avoid navigation and preceding-speaker bleed. */
export function selectCanvasPassageOffset(text: string, query: string): number {
  const normalize = (word: string) => {
    const value = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    if (/^(produced|producer|production)$/.test(value)) return "production";
    if (/^(written|wrote|write)$/.test(value)) return "write";
    if (/^(recorded|recording|recordings)$/.test(value)) return "record";
    if (/^(released|releases|release)$/.test(value)) return "release";
    return value;
  };
  const stop = new Set(
    "the and for with from this that what which who when where why how does did was were are his her own words about used have into artist dutchyyy latasha".split(
      " ",
    ),
  );
  const terms = new Set(
    (query.match(/[\p{L}\p{N}]+/gu) ?? [])
      .map(normalize)
      .filter(w => w.length >= 3 && !stop.has(w)),
  );
  const words = [...text.matchAll(/\S+/g)];
  const anchors = new Set(["foreword", "preface", "production", "write", "record", "release"]);
  const navigation = new Set([
    "buy",
    "usd",
    "cart",
    "checkout",
    "downloads",
    "tags",
    "license",
    "streaming",
  ]);
  let best = { offset: 0, score: 0 };
  for (let i = 0; i < words.length; i++) {
    const term = normalize(words[i][0]);
    if (!terms.has(term)) continue;
    // A heading identifies the speaker; otherwise retain a few words of immediate context.
    let start = anchors.has(term) ? i : Math.max(0, i - 3);
    if (!["foreword", "preface"].includes(term)) {
      const before = text.slice(0, words[start].index!);
      const boundary = [...before.matchAll(/[.!?][”"']?\s+/g)].at(-1);
      if (boundary) {
        const sentenceStart = boundary.index! + boundary[0].length;
        if (words[i].index! - sentenceStart < 100) {
          const sentenceWord = words.findIndex(word => word.index! >= sentenceStart);
          if (sentenceWord >= 0 && sentenceWord <= i) start = sentenceWord;
        }
      }
    }
    const window = words.slice(start, start + 25).map(w => normalize(w[0]));
    const hits = new Set(window.filter(w => terms.has(w)));
    const score =
      [...hits].reduce((sum, w) => sum + (anchors.has(w) ? 5 : 2), 0) -
      window.filter(w => navigation.has(w)).length * 3 +
      (anchors.has(term) ? 5 : 0);
    if (score > best.score) best = { offset: words[start].index!, score };
  }
  return best.offset;
}
