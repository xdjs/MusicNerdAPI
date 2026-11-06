import { beforeEach, expect, it, vi } from "vitest";
import { pdfCaptureFixture } from "./pdfCaptureFixture";
import { prepareEvaluation } from "./prepareEvaluation";
import { chatStreamTurn } from "../chatStreamTurn";
const m = vi.hoisted(() => ({ handler: vi.fn() }));
vi.mock("@/lib/chat/postArtistChatHandler", () => ({
  postArtistChatHandler: m.handler,
}));
beforeEach(() => {
  m.handler.mockReset();
});
it.each(["readPdfSource", "readNamedPdf"] as const)(
  "captures ordered page text via server observer for %s without public tool payload",
  async tool => {
    const f = pdfCaptureFixture(tool);
    m.handler.mockImplementation(async (_request, _artist, _stream, observe) => {
      observe({
        type: "source-url",
        sourceId: "1",
        url: f.output.url,
        title: "Synthetic",
      });
      observe({
        type: "tool-input-available",
        toolCallId: "pdf-call",
        toolName: tool,
        input: {},
      });
      observe({
        type: "tool-output-available",
        toolCallId: "pdf-call",
        output: f.output,
      });
      const chunks = [
        ...f.attribution.passages.map(data => ({
          type: "data-attributed-passage",
          data,
        })),
        {
          type: "data-attributed-status",
          data: { state: "complete-transport", pdfTextUnavailable: false },
        },
        { type: "finish", finishReason: "stop" },
      ];
      return new Response(chunks.map(c => `data: ${JSON.stringify(c)}\n\n`).join(""), {
        headers: { "Content-Type": "text/event-stream" },
      });
    });
    const turn = await chatStreamTurn({
      artistId: "fixture",
      question: "Which names were used?",
    });
    expect(turn.error).toBeUndefined();
    expect(turn.answer).toBe("");
    expect(turn.evidence).toHaveLength(6);
    expect(turn.attribution?.passages).toHaveLength(6);
    expect(turn.capture!.reads[0]).toMatchObject({
      complete: true,
      totalPages: 6,
      originalSha256: f.output.sha256,
      sourceId: f.output.sourceId,
      revision: f.output.revision,
    });
    expect(
      prepareEvaluation({
        ...f.input,
        ...turn,
        attributed: { ...turn.attribution!, state: "complete-transport" },
      }).status,
    ).toBe("ready");
  },
);
it.each([
  "native-only",
  "missing",
  "blank",
  "reordered",
  "duplicate",
  "mismatched-original",
  "missing-source-id",
] as const)("marks %s capture incomplete in actual chatStreamTurn", async kind => {
  const f = pdfCaptureFixture();
  if (kind === "missing-source-id") delete (f.output as { sourceId?: string }).sourceId;
  if (kind === "native-only") delete (f.output as { textPages?: unknown }).textPages;
  if (kind === "missing") f.output.textPages.pop();
  if (kind === "blank") f.output.textPages[0].text = "";
  if (kind === "reordered") f.output.textPages.reverse();
  if (kind === "duplicate") f.output.textPages[1] = structuredClone(f.output.textPages[0]);
  if (kind === "mismatched-original") f.output.textPages[0].originalSha256 = "0".repeat(64);
  m.handler.mockImplementation(async (_request, _artist, _stream, observe) => {
    observe({
      type: "source-url",
      sourceId: "1",
      url: f.output.url,
      title: "Synthetic",
    });
    observe({
      type: "tool-input-available",
      toolCallId: "pdf-call",
      toolName: "readPdfSource",
      input: {},
    });
    observe({
      type: "tool-output-available",
      toolCallId: "pdf-call",
      output: f.output,
    });
    return new Response(
      [
        { type: "text-start", id: "a" },
        { type: "text-delta", id: "a", delta: "A generated answer [1]." },
        { type: "text-end", id: "a" },
        { type: "finish", finishReason: "stop" },
      ]
        .map(c => `data: ${JSON.stringify(c)}\n\n`)
        .join(""),
    );
  });
  const turn = await chatStreamTurn({
    artistId: "fixture",
    question: "Which names were used?",
  });
  expect(turn.capture!.reads[0].complete).toBe(false);
  expect(prepareEvaluation({ ...f.input, ...turn, attributed: undefined }).status).toBe("unscored");
});
