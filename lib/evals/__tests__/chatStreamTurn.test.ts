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

    // The fake clock advances 100 ms per read: the first tool step is the first signal, the
    // first text delta comes later.
    expect(turn.firstSignalMs).toBe(100);
    expect(turn.firstSignalMs).toBeLessThan(turn.firstTextMs);
    const [request, artistId] = postArtistChatHandler.mock.calls[0];
    expect(artistId).toBe("a1");
    expect((await request.json()).messages).toEqual([
      { id: "eval-1", role: "user", parts: [{ type: "text", text: "Where?" }] },
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

  it("counts the text deltas and times the last one, to show whether text streams", async () => {
    postArtistChatHandler.mockResolvedValueOnce(
      streamOf([
        { type: "tool-input-available", toolCallId: "t", toolName: "searchPassages", input: {} },
        { type: "text-start", id: "x" },
        { type: "text-delta", id: "x", delta: "One " },
        { type: "text-delta", id: "x", delta: "two " },
        { type: "text-delta", id: "x", delta: "three." },
        { type: "text-end", id: "x" },
      ]),
    );
    // Clock reads: start 100, tool 200, deltas 300, 400, 500, end 600.
    const turn = await chatStreamTurn({ artistId: "a1", question: "Q?" }, fakeClock());
    expect(turn.textDeltas).toBe(3);
    expect(turn.firstTextMs).toBe(200);
    expect(turn.lastTextMs).toBe(400);
    expect(turn.totalMs).toBe(500);
  });

  it("reports no text deltas and no last text time for an answer without text", async () => {
    postArtistChatHandler.mockResolvedValueOnce(
      streamOf([{ type: "tool-input-available", toolCallId: "t", toolName: "x", input: {} }]),
    );
    const turn = await chatStreamTurn({ artistId: "a1", question: "Q?" }, fakeClock());
    expect(turn.textDeltas).toBe(0);
    expect(turn.lastTextMs).toBeUndefined();
  });

  it("records a text-free trace of the tool calls in order and counts steps", async () => {
    postArtistChatHandler.mockResolvedValueOnce(
      streamOf([
        { type: "start-step" },
        {
          type: "tool-input-available",
          toolCallId: "a",
          toolName: "searchPassages",
          input: { query: "secret query" },
        },
        {
          type: "tool-output-available",
          toolCallId: "a",
          output: {
            results: [{ n: 1, locator: "p.1", title: "Secret Title", passage: "Secret passage" }],
            weak: false,
            truncated: false,
            documents: [{ n: 1, shown: 1, units: 5, title: "Secret Title" }],
          },
        },
        { type: "finish-step" },
        { type: "start-step" },
        {
          type: "tool-input-available",
          toolCallId: "b",
          toolName: "readUnits",
          input: { n: 1, locators: ["p.2"] },
        },
        {
          type: "tool-output-available",
          toolCallId: "b",
          output: {
            n: 1,
            title: "Secret Title",
            units: [{ locator: "p.2", text: "Secret" }],
            truncated: false,
            missing: [],
          },
        },
        { type: "finish-step" },
        { type: "start-step" },
        { type: "text-start", id: "x" },
        { type: "text-delta", id: "x", delta: "Answer [1, p.2]." },
        { type: "text-end", id: "x" },
        { type: "finish-step" },
      ]),
    );

    const turn = await chatStreamTurn({ artistId: "a1", question: "Q" }, fakeClock());

    expect(turn.steps).toBe(3);
    expect(turn.trace).toEqual([
      {
        name: "searchPassages",
        atMs: 100,
        doneMs: 200,
        summary: "results=1 docs=1 shown/units=1/5 weak=false truncated=false expanded=none",
      },
      {
        name: "readUnits",
        atMs: 300,
        doneMs: 400,
        summary: "n=1 locators=1 units=1 truncated=false missing=0",
      },
    ]);
    expect(JSON.stringify(turn.trace)).not.toMatch(/secret/i);
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
    expect(turn.tools).toMatchObject([
      { name: "searchSources", input: { query: "q" } },
      { name: "searchPdfSources", input: { query: "q" } },
    ]);
  });
});

describe("chatStreamTurn follow-ups", () => {
  it("sends earlier messages before the question and returns this answer as the parts a client would send back", async () => {
    postArtistChatHandler.mockResolvedValueOnce(
      streamOf([
        {
          type: "tool-input-available",
          toolCallId: "r",
          toolName: "readPdfSource",
          input: { sourceId: "pdf-1" },
        },
        {
          type: "source-url",
          sourceId: "1",
          url: "https://x.supabase.co/t.pdf",
          title: "timeline.pdf",
        },
        {
          type: "tool-output-available",
          toolCallId: "r",
          output: {
            sourceId: "pdf-1",
            n: 1,
            title: "timeline.pdf",
            pages: 2,
            sha256: "no",
            revision: "r1",
          },
        },
        { type: "text-start", id: "x" },
        { type: "text-delta", id: "x", delta: "Dutchy [1, p.1]." },
        { type: "text-end", id: "x" },
      ]),
    );
    const history = [
      { id: "eval-1", role: "user" as const, parts: [{ type: "text", text: "What names?" }] },
      { id: "a1", role: "assistant" as const, parts: [{ type: "text", text: "Three names [1]." }] },
    ];
    const turn = await chatStreamTurn(
      { artistId: "a1", question: "Which is the producer?" },
      fakeClock(),
      history,
    );
    const body = await postArtistChatHandler.mock.calls[0][0].json();
    expect(body.messages).toEqual([
      ...history,
      { id: "eval-3", role: "user", parts: [{ type: "text", text: "Which is the producer?" }] },
    ]);
    expect(turn.assistantParts).toEqual([
      {
        type: "tool-readPdfSource",
        toolCallId: "r",
        state: "output-available",
        input: { sourceId: "pdf-1" },
        output: {
          sourceId: "pdf-1",
          n: 1,
          title: "timeline.pdf",
          pages: 2,
          sha256: "no",
          revision: "r1",
        },
      },
      { type: "text", text: "Dutchy [1, p.1]." },
    ]);
  });
});

describe("chatStreamTurn passage tools", () => {
  it("keeps the passage tool parts, with their documents, in the parts for the next turn", async () => {
    const documents = [
      {
        n: 1,
        sourceKind: "vault",
        sourceId: "00000000-0000-4000-8000-000000000001",
        revision: "r1",
        title: "Doc",
        url: "https://a.example/d.pdf",
      },
    ];
    const output = {
      results: [{ n: 1, locator: "p.2", title: "Doc", passage: "Born in 1970." }],
      weak: false,
      documents,
    };
    postArtistChatHandler.mockResolvedValueOnce(
      streamOf([
        {
          type: "tool-input-available",
          toolCallId: "s",
          toolName: "searchPassages",
          input: { query: "born" },
        },
        { type: "tool-output-available", toolCallId: "s", output },
        { type: "source-url", sourceId: "1", url: "https://cited.example/d.pdf", title: "Doc" },
        { type: "text-start", id: "x" },
        { type: "text-delta", id: "x", delta: "1970 [1, p.2]." },
        { type: "text-end", id: "x" },
      ]),
    );
    const turn = await chatStreamTurn({ artistId: "a1", question: "Born?" }, fakeClock());
    // The source-url part arrives after the output here; the evidence still takes its url.
    expect(turn.evidence?.[0]).toMatchObject({ url: "https://cited.example/d.pdf" });
    expect(turn.evidence?.[0]).toMatchObject({
      tool: "searchPassages",
      text: "[p.2]\nBorn in 1970.",
    });
    expect(turn.assistantParts).toEqual([
      {
        type: "tool-searchPassages",
        toolCallId: "s",
        state: "output-available",
        input: { query: "born" },
        output,
      },
      { type: "text", text: "1970 [1, p.2]." },
    ]);
  });
});
