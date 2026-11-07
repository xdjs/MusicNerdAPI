import { createHash } from "node:crypto";
import type { EvaluationInput, PreparedEvaluation } from "./types";
import { EVALUATION_INSTRUCTIONS } from "./evaluationInstructions";
/** Pure diagnostic input preparation. Never calls a provider or returns a semantic grade. */
export function prepareEvaluation(input: EvaluationInput): PreparedEvaluation {
  const fail = (reason: string): PreparedEvaluation => ({
    status: "unscored",
    reason,
    ...(input.attributed ? { attributed: structuredClone(input.attributed) } : {}),
  });
  if (input.error) return fail(`Turn error: ${input.error}`);
  if (input.attributed) {
    if (input.attributed.state !== "complete-transport")
      return fail(
        `Attributed output is ${input.attributed.state}; semantic evaluation is unavailable.`,
      );
    if (input.attributed.pdfTextUnavailable)
      return fail("Original PDF textual capture is unavailable.");
    if (!input.attributed.passages.length)
      return fail("Attributed output has no selected passages.");
    if (new Set(input.attributed.passages.map(p => p.id)).size !== input.attributed.passages.length)
      return fail("Duplicate attributed passage identity.");
    for (const p of input.attributed.passages) {
      if (!p.id || !p.sourceId || !p.revision || !p.text.trim())
        return fail("Incomplete attributed passage metadata.");
      const sources = input.sources.filter(s => s.n === p.n);
      if (!Number.isSafeInteger(p.n) || p.n < 1 || sources.length !== 1 || sources[0].url !== p.url)
        return fail("Missing or ambiguous attributed citation metadata.");
    }
  } else if (!input.answer.trim()) return fail("Answer is empty.");
  if (!input.capture?.complete) return fail("Complete read capture inventory is absent.");
  if (!input.evidence) return fail("Evidence capture is absent.");
  const evidence = input.evidence;
  const reads = input.capture.reads;
  if (new Set(reads.map(r => r.toolCallId)).size !== reads.length)
    return fail("Ambiguous read capture identity.");
  for (const read of reads) {
    const rows = evidence.filter(e => e.toolCallId === read.toolCallId && e.tool === read.tool);
    if (!read.complete || !rows.length)
      return fail(`Missing or incomplete textual capture: ${read.toolCallId}.`);
    if (read.tool === "readPdfSource" || read.tool === "readNamedPdf") {
      if (!Number.isSafeInteger(read.totalPages) || read.totalPages! < 1)
        return fail(`Missing PDF page accounting: ${read.toolCallId}.`);
      if (
        !read.sourceId ||
        !read.revision ||
        !read.originalSha256 ||
        !/^[a-f0-9]{64}$/.test(read.originalSha256) ||
        rows.length !== read.totalPages ||
        new Set(rows.map(e => e.readId)).size !== rows.length ||
        rows.some(
          (e, i) =>
            e.kind !== "pdf-page-text" ||
            e.sourceId !== read.sourceId ||
            e.revision !== read.revision ||
            e.originalSha256 !== read.originalSha256 ||
            e.physicalPage !== i + 1 ||
            e.physicalPages !== read.totalPages ||
            e.pageSha256 !== e.sha256 ||
            e.start !== 0 ||
            e.end !== e.text.length ||
            !e.readId ||
            e.n !== rows[0].n ||
            e.url !== rows[0].url,
        )
      )
        return fail(
          `Missing, incomplete, or mismatched original-bound PDF page capture: ${read.toolCallId}.`,
        );
    }
  }
  // Preserve the target's all-read invariant: an uncited source mapping cannot
  // disappear merely because the capture inventory omitted its successful read.
  for (const source of input.sources) {
    if (
      input.sources.filter(s => s.n === source.n).length !== 1 ||
      !evidence.some(e => e.n === source.n && e.url === source.url)
    )
      return fail("All-read evidence capture is incomplete or ambiguous.");
  }
  for (const e of evidence) {
    if (!reads.some(r => r.toolCallId === e.toolCallId && r.tool === e.tool))
      return fail("Unaccounted captured evidence.");
    if (!e.text.trim() || createHash("sha256").update(e.text).digest("hex") !== e.sha256)
      return fail("Missing text or capture hash mismatch.");
    const sources = input.sources.filter(s => s.n === e.n);
    if (!Number.isSafeInteger(e.n) || e.n < 1 || sources.length !== 1 || sources[0].url !== e.url)
      return fail(`Missing or ambiguous source mapping: [${e.n}].`);
  }
  if (input.attributed) {
    for (const p of input.attributed.passages) {
      const matches = evidence.filter(e => {
        if (
          (p.kind === "pdf-page-text"
            ? !["readPdfSource", "readNamedPdf"].includes(e.tool) ||
              e.kind !== p.kind ||
              e.originalSha256 !== p.originalSha256 ||
              e.physicalPage !== p.physicalPage ||
              e.physicalPages !== p.physicalPages ||
              e.pageSha256 !== p.pageSha256 ||
              p.context !== "pdf-page-context-v1" ||
              p.contextIncomplete !== true
            : e.tool !== "readSource" ||
              e.kind !== undefined ||
              p.context !== "bounded-read-context-v1") ||
          e.n !== p.n ||
          e.url !== p.url ||
          e.sourceId !== p.sourceId ||
          e.revision !== p.revision ||
          e.readId !== p.readId ||
          e.start !== p.readStart ||
          e.end !== p.readEnd ||
          e.sha256 !== p.readSha256 ||
          !Number.isSafeInteger(e.start) ||
          !Number.isSafeInteger(e.end) ||
          e.start! < 0 ||
          e.end! - e.start! !== e.text.length ||
          !Number.isSafeInteger(p.start) ||
          !Number.isSafeInteger(p.end) ||
          p.start < e.start! ||
          p.end > e.end! ||
          p.end <= p.start ||
          typeof p.contextIncomplete !== "boolean" ||
          !p.readId
        )
          return false;
        const selected = e.text.slice(p.start - e.start!, p.end - e.start!);
        if (selected !== p.text || createHash("sha256").update(selected).digest("hex") !== p.sha256)
          return false;
        const keys = [
          "id",
          "sourceId",
          "revision",
          "start",
          "end",
          "sha256",
          "readId",
          "readStart",
          "readEnd",
          "readSha256",
          "context",
          "coverage",
          "contextIncomplete",
          "kind",
          "originalSha256",
          "physicalPage",
          "physicalPages",
          "pageSha256",
        ] as const;
        return e.allowedBlocks?.some(b => keys.every(k => b[k] === p[k])) === true;
      });
      if (!matches.length)
        return fail("Selected passage lacks exact server-issued captured block provenance.");
    }
  }
  // Include comma-separated markers; do not parse source text as answer citations.
  const cited = [
    ...new Set(
      input.attributed
        ? input.attributed.passages.map(p => p.n)
        : [...input.answer.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)].flatMap(m =>
            m[1].split(",").map(Number),
          ),
    ),
  ];
  const citedSupport = cited.map(n => ({
    n,
    evidenceIndexes: evidence.flatMap((e, i) => (e.n === n ? [i] : [])),
  }));
  if (citedSupport.some(c => !c.evidenceIndexes.length))
    return fail("Missing captured evidence for answer citation.");
  if (evidence.reduce((n, e) => n + e.text.length, 0) > 96000)
    return fail(
      "All captured evidence exceeds the 96000-character judge limit; no silent truncation.",
    );
  return {
    status: "ready",
    instructions: EVALUATION_INSTRUCTIONS,
    payload: {
      outputMode: input.attributed ? "attributed-passages" : "ordinary-answer",
      ...(input.attributed ? { attributed: structuredClone(input.attributed) } : {}),
      question: input.question,
      reference: input.reference,
      answerable: input.answerable,
      answer: input.answer,
      evidence: structuredClone(evidence),
      citedSupport,
      inventoryEvidenceIndexes: evidence.map((_, i) => i),
      coverageScope: "captured reads only; not whole corpus",
    },
  };
}
