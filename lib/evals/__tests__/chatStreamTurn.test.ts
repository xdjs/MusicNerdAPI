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

  it("records an error part in the stream", async () => {
    postArtistChatHandler.mockResolvedValueOnce(
      streamOf([{ type: "error", errorText: "gateway down" }]),
    );

    const turn = await chatStreamTurn({ artistId: "a1", question: "q" }, fakeClock());

    expect(turn.error).toBe("gateway down");
    expect(turn.answer).toBe("");
  });
});
