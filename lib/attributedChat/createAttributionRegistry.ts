import { createHash } from "node:crypto";
import type { Passage, ReadOriginal, ReadResult } from "./types";

/** Register exact bounded literal bundles within actually-read original windows. */
export function createAttributionRegistry(options: {
  artistId: string;
  turnId: string;
  maxTextCharacters?: 6000 | 12000;
  assertCurrent: (original: ReadOriginal) => Promise<void>;
  assertCurrentBatch?: (originals: ReadOriginal[]) => Promise<void>;
}) {
  const maxTextCharacters = options.maxTextCharacters ?? 6000;
  if (maxTextCharacters !== 6000 && maxTextCharacters !== 12000)
    throw new Error("Unsupported attributed text limit");
  const entries = new Map<string, { original: ReadOriginal; passage: Passage }>();
  let pdfUnavailable = false;
  const reads = new Set<string>();
  const pdfReads = new Set<string>();
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  const wellFormed = (s: string) => s.isWellFormed();
  const split = (s: string, p: number) =>
    p > 0 && p < s.length && /[\uD800-\uDBFF]/.test(s[p - 1]) && /[\uDC00-\uDFFF]/.test(s[p]);
  return {
    registerTextRead(original: ReadOriginal, output: ReadResult) {
      const start = output.start ?? 0;
      const end = output.end ?? output.text.length;
      const url = new URL(original.url);
      const pdf = original.kind === "pdf-page-text";
      const pdfIdentity = pdf
        ? {
            kind: "pdf-page-text" as const,
            originalSha256: original.originalSha256!,
            physicalPage: original.physicalPage!,
            physicalPages: original.physicalPages!,
            pageSha256: original.pageSha256!,
          }
        : {};
      if (
        pdf &&
        (!/^[a-f0-9]{64}$/.test(original.originalSha256 ?? "") ||
          !Number.isSafeInteger(original.physicalPage) ||
          !Number.isSafeInteger(original.physicalPages) ||
          original.physicalPage! < 1 ||
          original.physicalPage! > original.physicalPages! ||
          original.physicalPages! > 50 ||
          original.pageSha256 !== hash(original.text) ||
          start !== 0 ||
          end !== original.text.length)
      )
        throw new Error("Invalid original-bound PDF page");
      if (
        !pdf &&
        [
          original.originalSha256,
          original.physicalPage,
          original.physicalPages,
          original.pageSha256,
        ].some(value => value !== undefined)
      )
        throw new Error("Unexpected PDF identity on saved text");
      if (
        !options.artistId ||
        !options.turnId ||
        !original.sourceId ||
        !original.revision ||
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        output.url !== original.url ||
        !Number.isSafeInteger(output.n) ||
        output.n < 1 ||
        typeof output.title !== "string" ||
        output.title.length > 500 ||
        !wellFormed(output.title) ||
        !wellFormed(original.text) ||
        !wellFormed(output.text) ||
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        end <= start ||
        end > original.text.length ||
        end - start > (pdf ? 24000 : 12000) ||
        split(original.text, start) ||
        split(original.text, end) ||
        original.text.slice(start, end) !== output.text
      )
        throw new Error("Invalid original-bound read");
      const readSha256 = hash(output.text);
      const readId = hash(
        JSON.stringify([
          options.artistId,
          options.turnId,
          original.sourceId,
          original.revision,
          start,
          end,
          readSha256,
          pdfIdentity,
        ]),
      );
      const pdfReadKey = JSON.stringify([
        original.sourceId,
        original.revision,
        original.originalSha256,
      ]);
      if (
        pdf
          ? !pdfReads.has(pdfReadKey) && pdfReads.size >= 2
          : !reads.has(readId) && reads.size >= 16
      )
        throw new Error("Read registry limit reached");
      // Geometry-only navigation choices, not semantic context-completeness claims.
      // PDF full-page choices preserve headings/layout scope when the text budget permits.
      const ranges: [number, number][] = [];
      const addRange = (from: number, to: number) => {
        if (split(original.text, from)) from++;
        if (split(original.text, to)) to--;
        if (to > from && !ranges.some(([a, b]) => a === from && b === to)) ranges.push([from, to]);
      };
      if (pdf) {
        if (end - start <= 6000) addRange(start, end);
        // Group adjacent literal lines into small focus units, then keep adjacent
        // units as context. No dates, artist names, reference facts or label heuristics.
        const units: [number, number][] = [];
        let from = start;
        while (from < end) {
          const target = Math.min(end, from + 300);
          let to = original.text.indexOf("\n", target);
          if (to < 0 || to + 1 - from > 600) to = Math.min(end, from + 600);
          else to++;
          if (split(original.text, to)) to--;
          units.push([from, to]);
          from = to;
        }
        for (let i = 0; i < units.length; i++)
          addRange(units[Math.max(0, i - 1)][0], units[Math.min(units.length - 1, i + 1)][1]);
      } else if (end - start <= 2400) addRange(start, end);
      else
        for (let focus = start; focus < end; focus += 1200)
          addRange(Math.max(start, focus - 400), Math.min(end, focus + 1800));
      if (output.reopen) {
        const locator = output.reopen;
        if (
          !pdf ||
          !Number.isSafeInteger(locator.start) ||
          !Number.isSafeInteger(locator.end) ||
          locator.start < start ||
          locator.end > end ||
          locator.end <= locator.start ||
          locator.end - locator.start > 6000 ||
          split(original.text, locator.start) ||
          split(original.text, locator.end) ||
          hash(original.text.slice(locator.start, locator.end)) !== locator.sha256
        )
          throw new Error("Invalid current PDF navigation window");
        addRange(locator.start, locator.end);
      }
      const passages = ranges.map(([blockStart, blockEnd]): Passage => {
        const text = original.text.slice(blockStart, blockEnd);
        const sha256 = hash(text);
        const context = pdf
          ? ("pdf-page-context-v1" as const)
          : ("bounded-read-context-v1" as const);
        const id = hash(JSON.stringify([readId, blockStart, blockEnd, sha256, context]));
        const complete =
          !pdf &&
          original.truncated === false &&
          blockStart === 0 &&
          blockEnd === original.text.length;
        return {
          id,
          ...pdfIdentity,
          sourceId: original.sourceId,
          revision: original.revision,
          sha256,
          n: output.n,
          title: output.title,
          url: output.url,
          text,
          start: blockStart,
          end: blockEnd,
          coverage: complete ? "complete-read" : "partial-read",
          context,
          contextIncomplete: !complete,
          readId,
          readStart: start,
          readEnd: end,
          readSha256,
        };
      });
      if (entries.size + passages.filter(p => !entries.has(p.id)).length > 2048)
        throw new Error("Registered block limit reached");
      for (const passage of passages) {
        const existing = entries.get(passage.id);
        if (
          existing &&
          (JSON.stringify(existing.passage) !== JSON.stringify(passage) ||
            existing.original.text !== original.text ||
            existing.original.url !== original.url)
        )
          throw new Error("Conflicting read registration");
      }
      if (pdf) pdfReads.add(pdfReadKey);
      else reads.add(readId);
      for (const passage of passages)
        if (!entries.has(passage.id))
          entries.set(passage.id, {
            original: structuredClone(original),
            passage,
          });
      return {
        ...pdfIdentity,
        sourceId: original.sourceId,
        revision: original.revision,
        start,
        end,
        readId,
        sha256: readSha256,
        blocks: passages.map(({ text, n: _n, title: _title, url: _url, ...descriptor }) => ({
          ...descriptor,
          preview: text.slice(0, 160),
        })),
        limitation: `IDs identify exact bounded source excerpts, not relevance, completeness, or a resolved answer. Surrounding context may be omitted. Keep directly responsive contexts within ${maxTextCharacters} literal UTF-16 text characters total. Up to 24 passages is only a resource guard; preserve relevant qualifications rather than dropping facts to satisfy a small block count.`,
      };
    },
    notePdfUnavailable() {
      pdfUnavailable = true;
      return {
        blocks: [],
        unavailable: "verified_pdf_page_text_unavailable" as const,
      };
    },
    get pdfUnavailable() {
      return pdfUnavailable;
    },
    async resolve(ids: string[], signal: AbortSignal): Promise<Passage[]> {
      signal.throwIfAborted();
      if (!ids.length || ids.length > 24 || new Set(ids).size !== ids.length)
        throw new Error("Invalid block selection");
      const selected = ids.map(id => {
        const row = entries.get(id);
        if (!row) throw new Error("Unknown read-bound block");
        return row;
      });
      // Current readers remain the authority. This is a pre-emission check, not a cross-source DB lock.
      await new Promise<void>((resolve, reject) => {
        const aborted = () => reject(signal.reason ?? new Error("Aborted"));
        signal.addEventListener("abort", aborted, { once: true });
        (options.assertCurrentBatch
          ? options.assertCurrentBatch(selected.map(row => structuredClone(row.original)))
          : Promise.all(selected.map(row => options.assertCurrent(structuredClone(row.original))))
        ).then(
          () => {
            signal.removeEventListener("abort", aborted);
            resolve();
          },
          error => {
            signal.removeEventListener("abort", aborted);
            reject(error);
          },
        );
        if (signal.aborted) aborted();
      });
      signal.throwIfAborted();
      return selected.map(row => structuredClone(row.passage));
    },
  };
}
