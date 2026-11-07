import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { prepareEvaluation } from "./prepareEvaluation";
import type { EvaluationInput } from "./types";
const fixture = (): EvaluationInput => {
  const text = "Exact source [99] footnote.";
  const binding = {
    sourceId: "s1",
    revision: "r1",
    start: 17,
    end: 17 + text.length,
    sha256: createHash("sha256").update(text).digest("hex"),
    context: "bounded-read-context-v1",
    contextIncomplete: false,
    coverage: "partial-read" as const,
  };
  const descriptor = {
    ...binding,
    id: "block",
    readId: "read-1",
    readStart: binding.start,
    readEnd: binding.end,
    readSha256: binding.sha256,
  };
  return {
    question: "first?",
    reference: "unresolved",
    answerable: true,
    answer: "",
    sources: [{ n: 1, url: "https://example.test" }],
    capture: {
      complete: true,
      reads: [{ tool: "readSource", toolCallId: "call", complete: true }],
    },
    evidence: [
      {
        ...binding,
        readId: "read-1",
        allowedBlocks: [descriptor],
        n: 1,
        url: "https://example.test",
        text,
        tool: "readSource",
        toolCallId: "call",
      },
    ],
    attributed: {
      state: "complete-transport",
      pdfTextUnavailable: false,
      passages: [{ ...descriptor, n: 1, url: "https://example.test", text }],
    },
  };
};
it("accepts exact captured source-revision-window binding", () => {
  expect(prepareEvaluation(fixture()).status).toBe("ready");
});
it.each([
  "id",
  "sourceId",
  "revision",
  "start",
  "end",
  "sha256",
  "text",
  "context",
  "coverage",
  "readId",
  "readStart",
  "readEnd",
  "readSha256",
] as const)("rejects altered passage %s even with matching URL and citation number", key => {
  const x = fixture();
  const p = x.attributed!.passages[0] as unknown as Record<string, unknown>;
  p[key] = typeof p[key] === "number" ? (p[key] as number) + 1 : "forged";
  expect(prepareEvaluation(x).status).toBe("unscored");
});
it.each(["sourceId", "revision", "start", "end", "context", "coverage"] as const)(
  "rejects absent captured %s provenance",
  key => {
    const x = fixture();
    if (key === "context" || key === "coverage")
      delete (x.evidence![0].allowedBlocks![0] as unknown as Record<string, unknown>)[key];
    else delete (x.evidence![0] as unknown as Record<string, unknown>)[key];
    expect(prepareEvaluation(x).status).toBe("unscored");
  },
);
it("rejects search snippet as selectable original", () => {
  const x = fixture();
  x.evidence![0].tool = "webSearch";
  x.capture!.reads[0].tool = "webSearch";
  expect(prepareEvaluation(x).status).toBe("unscored");
});
it("rejects invalid bounds even when identical in evidence and passage", () => {
  const x = fixture();
  x.evidence![0].end = 999;
  x.attributed!.passages[0].end = 999;
  expect(prepareEvaluation(x).status).toBe("unscored");
});

it("rejects recomputed but unregistered selection", () => {
  const x = fixture();
  x.evidence![0].allowedBlocks = [];
  expect(prepareEvaluation(x).status).toBe("unscored");
});
it("accepts a registered exact substring rather than requiring whole-read output", () => {
  const x = fixture();
  const e = x.evidence![0];
  const p = x.attributed!.passages[0];
  e.text = "prefix " + e.text + " suffix";
  e.start = 10;
  e.end = 10 + e.text.length;
  e.sha256 = createHash("sha256").update(e.text).digest("hex");
  p.readStart = e.start;
  p.readEnd = e.end;
  p.readSha256 = e.sha256;
  e.allowedBlocks = [{ ...p }];
  expect(prepareEvaluation(x).status).toBe("ready");
});
it("rejects changed context-incomplete metadata", () => {
  const x = fixture();
  x.attributed!.passages[0].contextIncomplete = true;
  expect(prepareEvaluation(x).status).toBe("unscored");
});
