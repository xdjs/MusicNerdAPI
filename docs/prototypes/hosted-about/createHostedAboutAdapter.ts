import type { DocSource } from "@/lib/lore/types";

type Stage = "lore" | "about" | "summary";
type Mode = "ok" | "fail" | "empty" | "wait-for-abort";
type Options = { abortSignal?: AbortSignal; onTextDelta?: (text: string) => void };

/** Isolated test-build model boundaries. Configuration is supplied by server code, never a request. */
export function createHostedAboutAdapter(
  plan: Readonly<Partial<Record<Stage, Mode>>>,
  loadSources: (artistId: string) => Promise<DocSource[]>,
) {
  const modes = Object.freeze({ ...plan });
  const counts = { lore: 0, about: 0, summary: 0 };
  async function run(stage: Stage, signal?: AbortSignal) {
    signal?.throwIfAborted();
    counts[stage]++;
    const mode = modes[stage] ?? "ok";
    if (mode === "fail") throw new Error(`Synthetic ${stage} failure`);
    if (mode === "wait-for-abort") {
      if (!signal) throw new Error("Synthetic wait requires an AbortSignal");
      await new Promise<never>((_resolve, reject) => {
        const abort = () => reject(signal.reason ?? new Error("Synthetic call aborted"));
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) {
          signal.removeEventListener("abort", abort);
          abort();
        }
      });
    }
    signal?.throwIfAborted();
    return mode;
  }
  return Object.freeze({
    counters: () => Object.freeze({ ...counts }),
    async synthesizeArtistDoc(
      artistId: string,
      presetSources?: DocSource[],
      options: Options = {},
    ) {
      const mode = await run("lore", options.abortSignal);
      const sources = presetSources ?? (await loadSources(artistId));
      options.abortSignal?.throwIfAborted();
      if (mode === "empty") throw new Error("Synthetic Lore returned empty text");
      const doc = `Synthetic Lore${sources.length ? ` [${sources[0].id}]` : ""}`;
      options.onTextDelta?.(doc);
      return { doc, sources };
    },
    async generateAboutFromDoc(
      _artistName: string,
      _doc: string,
      sources: DocSource[] = [],
      options: Options = {},
    ) {
      const mode = await run("about", options.abortSignal);
      const text =
        mode === "empty" ? "" : `Synthetic About${sources.length ? ` [${sources[0].id}]` : ""}`;
      options.onTextDelta?.(text);
      return text;
    },
    async generateLoreSummary(_artistId: string, signal?: AbortSignal): Promise<null> {
      await run("summary", signal);
      return null;
    },
  });
}
