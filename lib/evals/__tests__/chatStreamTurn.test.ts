import { describe, it, expect, vi, beforeEach } from "vitest";
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessageChunk } from "ai";
import { NextResponse } from "next/server";

const postArtistChatHandler = vi.fn();
vi.mock("@/lib/chat/postArtistChatHandler", () => ({
  postArtistChatHandler: (...a: unknown[]) => postArtistChatHandler(...a),
}));
const { chatStreamTurn } = await import("@/lib/evals/chatStreamTurn");

/** A clock that moves 100 ms each time it is read. */
const fakeClock = () => {
  let t = 0;
  return { now: () => (t += 100) };
};

const streamOf = (chunks: UIMessageChunk[]) =>
  createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => chunks.forEach(c => writer.write(c)),
    }),
  });

describe("chatStreamTurn", () => {
  beforeEach(() => postArtistChatHandler.mockReset());

  it("sends the question as one user message and times the first text", async () => {
    postArtistChatHandler.mockResolvedValueOnce(
      streamOf([
        { type: "tool-input-available", toolCallId: "t", toolName: "readSource", input: {} },
        { type: "source-url", sourceId: "1", url: "https://a.example", title: "A" },
        {
          type: "tool-output-available",
          toolCallId: "t",
          output: { n: 1, url: "https://a.example", text: "Born in Richmond." },
        },
        {
          type: "tool-input-available",
          toolCallId: "discover",
          toolName: "searchSources",
          input: {},
        },
        {
          type: "tool-output-available",
          toolCallId: "discover",
          output: { n: 2, url: "https://b.example", text: "Discovery only" },
        },
        { type: "text-start", id: "x" },
        { type: "text-delta", id: "x", delta: "Born in Richmond " },
        { type: "text-delta", id: "x", delta: "[1]." },
        { type: "text-end", id: "x" },
      ]),
    );

    const turn = await chatStreamTurn({ artistId: "a1", question: "Where?" }, fakeClock());

    const [request, artistId] = postArtistChatHandler.mock.calls[0];
    expect(artistId).toBe("a1");
    expect((await request.json()).messages).toEqual([
      { id: "eval", role: "user", parts: [{ type: "text", text: "Where?" }] },
    ]);
    expect(request.headers.get("x-real-ip")).toBe("192.0.2.1");
    expect(turn.answer).toBe("Born in Richmond [1].");
    expect(turn.sources).toEqual([{ n: 1, title: "A", url: "https://a.example" }]);
    expect(turn.evidence).toHaveLength(1);
    expect(turn.evidence?.[0]).toMatchObject({
      n: 1,
      url: "https://a.example",
      text: "Born in Richmond.",
      tool: "readSource",
      toolCallId: "t",
    });
    expect(turn.firstTextMs).toBeLessThan(turn.totalMs);
    expect(turn.error).toBeUndefined();
  });

  it("returns the error response's status and message", async () => {
    postArtistChatHandler.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Artist not found" }, { status: 404 }),
    );

    const turn = await chatStreamTurn({ artistId: "a1", question: "q" }, fakeClock());

    expect(turn).toMatchObject({ answer: "", sources: [], error: "404 Artist not found" });
  });

  it("keeps the allowance reset from a quota response, and nothing from other errors", async () => {
    postArtistChatHandler.mockResolvedValueOnce(
      NextResponse.json(
        {
          status: "error",
          code: "visitor_question_quota",
          error: "You've reached your question limit for this hour. Try again in 12 minutes.",
          retryAfterSeconds: 700,
          resetAt: "2026-11-12T20:00:00.000Z",
        },
        { status: 429 },
      ),
    );
    const turn = await chatStreamTurn({ artistId: "a1", question: "q" }, fakeClock());
    expect(turn).toMatchObject({
      error: "429 You've reached your question limit for this hour. Try again in 12 minutes.",
      retryAfterSeconds: 700,
    });

    postArtistChatHandler.mockResolvedValueOnce(
      NextResponse.json(
        { status: "error", error: "x", retryAfterSeconds: "soon" },
        { status: 500 },
      ),
    );
    expect(await chatStreamTurn({ artistId: "a1", question: "q" }, fakeClock())).not.toHaveProperty(
      "retryAfterSeconds",
    );
  });

  it("records an error part in the stream", async () => {
    postArtistChatHandler.mockResolvedValueOnce(
      streamOf([{ type: "error", errorText: "gateway down" }]),
    );

    const turn = await chatStreamTurn({ artistId: "a1", question: "q" }, fakeClock());

    expect(turn.error).toBe("gateway down");
    expect(turn.answer).toBe("");
  });
});

describe("chatStreamTurn PDF evidence", () => {
  it("captures a cited PDF read through the adapter using the streamed source URL, after timing", async () => {
    const readPdfChatEvidence = vi.fn(async () => [
      {
        n: 1,
        url: "https://a.example/t.pdf",
        text: "[page 1]\nAliases",
        tool: "readPdfSource" as const,
        toolCallId: "p",
        sha256: "h",
      },
    ]);
    vi.doMock("@/lib/evals/readPdfChatEvidence", () => ({ readPdfChatEvidence }));
    vi.resetModules();
    vi.doMock("@/lib/chat/postArtistChatHandler", () => ({
      postArtistChatHandler: (...a: unknown[]) => postArtistChatHandler(...a),
    }));
    const { chatStreamTurn: turnWithPdf } = await import("@/lib/evals/chatStreamTurn");
    postArtistChatHandler.mockResolvedValueOnce(
      streamOf([
        { type: "tool-input-available", toolCallId: "p", toolName: "readPdfSource", input: {} },
        { type: "source-url", sourceId: "1", url: "https://a.example/t.pdf", title: "t.pdf" },
        {
          type: "tool-output-available",
          toolCallId: "p",
          output: { sourceId: "s", n: 1, title: "t.pdf", pages: 1, sha256: "x".repeat(64) },
        },
        { type: "text-start", id: "x" },
        { type: "text-delta", id: "x", delta: "Aliases [1, p.1]." },
        { type: "text-end", id: "x" },
      ]),
    );
    const turn = await turnWithPdf({ artistId: "a1", question: "Aliases?" }, fakeClock());
    expect(readPdfChatEvidence).toHaveBeenCalledWith(
      "readPdfSource",
      "p",
      { sourceId: "s", n: 1, title: "t.pdf", pages: 1, sha256: "x".repeat(64) },
      "https://a.example/t.pdf",
    );
    expect(turn.evidence).toEqual([expect.objectContaining({ tool: "readPdfSource", n: 1 })]);
    expect(turn.sources).toEqual([{ n: 1, title: "t.pdf", url: "https://a.example/t.pdf" }]);
    vi.doUnmock("@/lib/evals/readPdfChatEvidence");
  });
});

describe("chatStreamTurn tool record", () => {
  it("records which tools ran and their inputs, for review", async () => {
    postArtistChatHandler.mockResolvedValueOnce(
      streamOf([
        {
          type: "tool-input-available",
          toolCallId: "a",
          toolName: "searchSources",
          input: { query: "q" },
        },
        {
          type: "tool-input-available",
          toolCallId: "b",
          toolName: "searchPdfSources",
          input: { query: "q" },
        },
        { type: "text-start", id: "x" },
        { type: "text-delta", id: "x", delta: "None." },
        { type: "text-end", id: "x" },
      ]),
    );
    const turn = await chatStreamTurn({ artistId: "a1", question: "Q?" }, fakeClock());
    expect(turn.tools).toEqual([
      { name: "searchSources", input: { query: "q" } },
      { name: "searchPdfSources", input: { query: "q" } },
    ]);
  });
});
