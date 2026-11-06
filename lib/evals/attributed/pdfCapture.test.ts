import { beforeEach, expect, it, vi } from "vitest";
import { readChatEvidence } from "../readChatEvidence";
import { prepareEvaluation } from "./prepareEvaluation";
import { pdfCaptureFixture } from "./pdfCaptureFixture";
import { judgeCitedAnswer } from "../judgeCitedAnswer";
const m = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/ai/generateObject", () => ({ generateObject: m.generate }));
beforeEach(() => {
  m.generate.mockReset().mockResolvedValue({
    output: {
      relevance: 0.5,
      groundedness: 0.5,
      reason: "mock",
      ...Object.fromEntries(
        [
          "citedSupport",
          "requestedInventoryCoverage",
          "counterevidenceHandling",
          "uncertaintyHandling",
          "responseUsability",
        ].map(k => [k, { score: 0.5, reason: "mock" }]),
      ),
    },
  });
});
it.each(["readPdfSource", "readNamedPdf"] as const)(
  "captures all six synthetic physical pages via %s",
  tool => {
    const f = pdfCaptureFixture(tool);
    expect(readChatEvidence(tool, "pdf-call", f.output)).toHaveLength(6);
    expect(prepareEvaluation(f.input).status).toBe("ready");
  },
);
it("records six selected fragments including repeated text on distinct physical pages", async () => {
  const f = pdfCaptureFixture();
  const r = await judgeCitedAnswer({
    question: f.input.question,
    reference: f.input.reference,
    answerable: true,
    turn: {
      ...f.input,
      sources: f.input.sources.map(s => ({
        ...s,
        title: "Synthetic original",
      })),
      attribution: f.attribution,
      firstTextMs: 0,
      totalMs: 5,
    },
  });
  expect(r.verdict).not.toBeNull();
  expect(m.generate).toHaveBeenCalledTimes(1);
  const prompt = JSON.parse(m.generate.mock.calls[0][0].prompt);
  expect(prompt.evidence).toHaveLength(6);
  expect(prompt.attributed.passages).toHaveLength(6);
  expect(prompt.attributed.passages[0].text).toBe(prompt.attributed.passages[1].text);
});
it.each([
  "missing",
  "blank",
  "reordered",
  "duplicate",
  "hash",
  "original",
  "source",
  "revision",
  "pageCount",
] as const)("fails closed on %s PDF capture", kind => {
  const f = pdfCaptureFixture();
  const p = f.output.textPages;
  if (kind === "missing") p.pop();
  if (kind === "blank") p[2].text = "";
  if (kind === "reordered") p.reverse();
  if (kind === "duplicate") p[1] = structuredClone(p[0]);
  if (kind === "hash") p[0].pageSha256 = "0".repeat(64);
  if (kind === "original") p[0].originalSha256 = "0".repeat(64);
  if (kind === "source") p[0].sourceId = "other";
  if (kind === "revision") p[0].revision = "other";
  if (kind === "pageCount") p[0].physicalPages = 7;
  expect(readChatEvidence("readPdfSource", "pdf-call", f.output)).toEqual([]);
});
it.each(["originalSha256", "physicalPage", "physicalPages", "pageSha256", "kind"] as const)(
  "rejects altered selected PDF %s before judge even when page text is identical",
  async key => {
    const f = pdfCaptureFixture();
    const p = f.input.attributed!.passages[0] as unknown as Record<string, unknown>;
    p[key] = key === "physicalPage" ? 2 : key === "physicalPages" ? 7 : "forged";
    const r = await judgeCitedAnswer({
      question: f.input.question,
      reference: f.input.reference,
      answerable: true,
      turn: {
        ...f.input,
        sources: f.input.sources.map(s => ({
          ...s,
          title: "Synthetic original",
        })),
        attribution: f.attribution,
        firstTextMs: 0,
        totalMs: 5,
      },
    });
    expect(r.verdict).toBeNull();
    expect(m.generate).not.toHaveBeenCalled();
  },
);
it("independently rejects reordered evidence despite a forged complete flag", () => {
  const f = pdfCaptureFixture();
  f.input.evidence!.reverse();
  expect(prepareEvaluation(f.input).status).toBe("unscored");
});
it("rejects missing original hash in complete capture manifest", () => {
  const f = pdfCaptureFixture();
  delete f.input.capture!.reads[0].originalSha256;
  expect(prepareEvaluation(f.input).status).toBe("unscored");
});
it("native-only PDF outputs remain uncaptured and unscored", () => {
  const f = pdfCaptureFixture();
  delete (f.output as { textPages?: unknown }).textPages;
  expect(readChatEvidence("readPdfSource", "pdf-call", f.output)).toEqual([]);
  f.input.capture!.reads[0].complete = false;
  expect(prepareEvaluation(f.input).status).toBe("unscored");
});
it.each([
  "missing",
  "blank",
  "duplicate",
  "pageHash",
  "readIdentity",
  "source",
  "revision",
  "original",
] as const)("rechecks %s captured PDF evidence independently of adapter complete flag", kind => {
  const f = pdfCaptureFixture();
  const e = f.input.evidence!;
  if (kind === "missing") e.pop();
  if (kind === "blank") e[0].text = "";
  if (kind === "duplicate") e[1] = structuredClone(e[0]);
  if (kind === "pageHash") e[0].pageSha256 = "0".repeat(64);
  if (kind === "readIdentity") e[1].readId = e[0].readId;
  if (kind === "source") e[0].sourceId = "different";
  if (kind === "revision") e[0].revision = "different";
  if (kind === "original") e[0].originalSha256 = "0".repeat(64);
  expect(prepareEvaluation(f.input).status).toBe("unscored");
});
it("missing PDF kind on selected passage cannot be downgraded to ordinary source binding", () => {
  const f = pdfCaptureFixture();
  delete f.input.attributed!.passages[0].kind;
  expect(prepareEvaluation(f.input).status).toBe("unscored");
});
it("PDF contextIncomplete cannot falsely become complete", () => {
  const f = pdfCaptureFixture();
  f.input.attributed!.passages[0].contextIncomplete = false;
  expect(prepareEvaluation(f.input).status).toBe("unscored");
});
it("unknown PDF context policy is rejected", () => {
  const f = pdfCaptureFixture();
  f.input.attributed!.passages[0].context = "invented";
  expect(prepareEvaluation(f.input).status).toBe("unscored");
});
