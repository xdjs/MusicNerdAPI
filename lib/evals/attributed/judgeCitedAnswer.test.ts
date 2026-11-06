import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { ChatTurn } from "../ChatTurn";
import { diagnosticVerdictSchema } from "./diagnosticVerdictSchema";
import { answerVerdictSchema } from "../answerVerdictSchema";
import { judgeCitedAnswer } from "../judgeCitedAnswer";
const m = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/ai/generateObject", () => ({ generateObject: m.generate }));
const text = (n: number, value: string) => ({
  n,
  url: `https://example.test/${n}`,
  text: value,
  tool: "readSource" as const,
  toolCallId: `read-${n}`,
  sha256: createHash("sha256").update(value).digest("hex"),
});
const turn = (): ChatTurn => ({
  answer: "First collaboration [1].",
  sources: [
    { n: 1, title: "One", url: "https://example.test/1" },
    { n: 2, title: "Two", url: "https://example.test/2" },
  ],
  firstTextMs: 1,
  totalMs: 2,
  evidence: [text(1, "First collaboration."), text(2, "Uncited competing joint recording.")],
  capture: {
    complete: true,
    reads: [
      { toolCallId: "read-1", tool: "readSource", complete: true },
      { toolCallId: "read-2", tool: "readSource", complete: true },
    ],
  },
});
const run = (t: ChatTurn) =>
  judgeCitedAnswer({
    question: "First?",
    reference: "Leave unresolved.",
    answerable: true,
    turn: t,
  });
beforeEach(() => {
  m.generate.mockReset().mockResolvedValue({
    output: {
      ...Object.fromEntries(
        [
          "citedSupport",
          "requestedInventoryCoverage",
          "counterevidenceHandling",
          "uncertaintyHandling",
          "responseUsability",
        ].map(k => [k, { score: 0.5, reason: "mock dimension" }]),
      ),
      relevance: 0.5,
      groundedness: 0.5,
      reason: "mock, not a semantic finding",
    },
  });
});
it("passes all reads to the mocked judge and returns separate preflight diagnostic", async () => {
  const r = await run(turn());
  const args = m.generate.mock.calls[0][0];
  const prompt = JSON.parse(args.prompt);
  expect(prompt.evidence).toHaveLength(2);
  expect(prompt.citedSupport).toEqual([{ n: 1, evidenceIndexes: [0] }]);
  expect(prompt.inventoryEvidenceIndexes).toEqual([0, 1]);
  expect(args.schema).toBe(diagnosticVerdictSchema);
  expect(
    answerVerdictSchema.safeParse({
      relevance: 2,
      groundedness: 0,
      reason: "invalid",
    }).success,
  ).toBe(false);
  expect(r).toHaveProperty("diagnostic.status", "ready");
  expect(r.verdict).toEqual({
    relevance: 0.5,
    groundedness: 0.5,
    reason: "mock, not a semantic finding",
  });
});
it("uses typed citations rather than parsing literal footnotes", async () => {
  const t = turn();
  t.answer = "";
  t.attribution = {
    state: "complete-transport",
    pdfTextUnavailable: false,
    passages: [
      {
        id: "block",
        sourceId: "source",
        revision: "revision",
        sha256: "unused-for-diagnostic",
        n: 1,
        url: "https://example.test/1",
        title: "One",
        text: "Literal [99] [The Chill Factor] [1, 9]",
        start: 0,
        end: 45,
        coverage: "complete-read",
        context: "bounded-read-context-v1",
        contextIncomplete: false,
        readId: "read-window-1",
        readStart: 0,
        readEnd: 45,
        readSha256: "pending",
      },
    ],
  };
  const selected = t.attribution!.passages[0];
  selected.start = 0;
  selected.end = selected.text.length;
  selected.sha256 = createHash("sha256").update(selected.text).digest("hex");
  Object.assign(selected, {
    readId: "read-window-1",
    readStart: 0,
    readEnd: selected.end,
    readSha256: selected.sha256,
    context: "bounded-read-context-v1",
    contextIncomplete: false,
  });
  t.evidence![0] = {
    ...text(1, selected.text),
    sourceId: selected.sourceId,
    revision: selected.revision,
    start: 0,
    end: selected.end,
    readId: "read-window-1",
    allowedBlocks: [{ ...selected }],
  };
  const r = await run(t);
  expect(r.verdict).not.toBeNull();
  const p = JSON.parse(m.generate.mock.calls[0][0].prompt);
  expect(p.citedSupport.map((s: { n: number }) => s.n)).toEqual([1]);
  expect(p.attributed.passages[0].text).toBe(t.attribution!.passages[0].text);
});
it.each(["readPdfSource", "readNamedPdf"] as const)(
  "skips judge for incomplete %s text capture",
  async tool => {
    const t = turn();
    t.capture!.reads.push({ toolCallId: "pdf", tool, complete: false });
    const r = await run(t);
    expect(r.verdict).toBeNull();
    expect(m.generate).not.toHaveBeenCalled();
  },
);
it("rejects unknown runtime attribution state", async () => {
  const t = turn();
  t.attribution = {
    state: "made-up-success",
    pdfTextUnavailable: false,
    passages: [],
  };
  expect((await run(t)).verdict).toBeNull();
  expect(m.generate).not.toHaveBeenCalled();
});
it("retains partial typed captures in unscored diagnostics", async () => {
  const t = turn();
  t.attribution = { state: "stopped", pdfTextUnavailable: false, passages: [] };
  const r = await run(t);
  expect(r).toHaveProperty("diagnostic.attributed.state", "stopped");
  expect(m.generate).not.toHaveBeenCalled();
});
it("refuses historical captures lacking explicit read inventory", async () => {
  const t = turn();
  delete t.capture;
  expect((await run(t)).verdict).toBeNull();
  expect(m.generate).not.toHaveBeenCalled();
});
it("keeps preflight diagnostics if judge fails", async () => {
  m.generate.mockRejectedValue(new Error("mock failure"));
  const r = await run(turn());
  expect(r.verdict).toBeNull();
  expect(r).toHaveProperty("diagnostic.status", "ready");
});

it("records five separate rubric dimensions without changing legacy verdict fields", async () => {
  const axes = Object.fromEntries(
    [
      "citedSupport",
      "requestedInventoryCoverage",
      "counterevidenceHandling",
      "uncertaintyHandling",
      "responseUsability",
    ].map(k => [k, { score: 0.25, reason: "mock dimension, not semantic evidence" }]),
  );
  m.generate.mockResolvedValue({
    output: { relevance: 0.5, groundedness: 0.5, reason: "legacy", ...axes },
  });
  const r = await run(turn());
  expect(r.rubricDiagnostic).toEqual(axes);
  expect(r.verdict).toEqual({
    relevance: 0.5,
    groundedness: 0.5,
    reason: "legacy",
  });
});
it("leaves rubric diagnostics unscored when capture is incomplete", async () => {
  const t = turn();
  t.capture!.complete = false;
  expect((await run(t)).rubricDiagnostic).toBeNull();
});

it.each(["text", "sourceId", "revision", "id"] as const)(
  "blocks fabricated %s before mocked judge dispatch",
  async key => {
    const t = turn();
    t.answer = "";
    const e = t.evidence![0];
    const descriptor = {
      id: "registered",
      sourceId: "s1",
      revision: "r1",
      start: 0,
      end: e.text.length,
      sha256: e.sha256,
      readId: "read1",
      readStart: 0,
      readEnd: e.text.length,
      readSha256: e.sha256,
      context: "bounded-read-context-v1" as const,
      contextIncomplete: false,
      coverage: "complete-read" as const,
    };
    Object.assign(e, {
      sourceId: "s1",
      revision: "r1",
      start: 0,
      end: e.text.length,
      readId: "read1",
      allowedBlocks: [{ ...descriptor }],
    });
    const selected = {
      ...descriptor,
      n: e.n,
      url: e.url,
      title: "One",
      text: e.text,
    };
    selected[key] = "fabricated";
    t.attribution = {
      state: "complete-transport",
      pdfTextUnavailable: false,
      passages: [selected],
    };
    const r = await run(t);
    expect(r.verdict).toBeNull();
    expect(r.rubricDiagnostic).toBeNull();
    expect(m.generate).not.toHaveBeenCalled();
  },
);
it("rejects missing semantic rubric fields instead of manufacturing independent passes", async () => {
  m.generate.mockResolvedValue({
    output: { relevance: 1, groundedness: 1, reason: "missing axes" },
  });
  const r = await run(turn());
  expect(r.verdict).toBeNull();
  expect(r.rubricDiagnostic).toBeNull();
});
