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
        { type: "finish", finishReason: "stop" },
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

const textChunks: UIMessageChunk[] = [
  { type: "text-start", id: "x" },
  { type: "text-delta", id: "x", delta: "Answer [1]." },
  { type: "text-end", id: "x" },
  { type: "finish", finishReason: "stop" },
];
function capture(limit = 100000) {
  const events: { kind: string; value: unknown }[] = [];
  let used = false,
    bytes = 0;
  return {
    events,
    requestId: "one",
    claim() {
      if (used) throw new Error("already_consumed");
      used = true;
    },
    record(kind: string, value: unknown) {
      const copy = JSON.stringify({ kind, value });
      bytes += Buffer.byteLength(copy);
      if (bytes > limit) throw new Error("capture_limit");
      events.push(JSON.parse(copy));
    },
  };
}
it("capture on/off preserves request, answer and citations; prior messages reach handler", async () => {
  postArtistChatHandler.mockReset();
  const messages = [
    { id: "prior", role: "assistant", parts: [{ type: "text", text: "Rei Alvarez." }] },
    { id: "followup", role: "user", parts: [{ type: "text", text: "Where is he from?" }] },
  ];
  postArtistChatHandler.mockImplementation(() => streamOf(textChunks));
  const input = { artistId: "a1", question: "Where is he from?", messages };
  const off = await chatStreamTurn(input, fakeClock());
  const c = capture();
  const on = await chatStreamTurn(input, fakeClock(), c);
  expect(on).toEqual(off);
  expect(on.error).toBeUndefined();
  expect(await postArtistChatHandler.mock.calls[1][0].json()).toEqual({ messages });
  expect(JSON.stringify(on)).not.toContain("requestId");
  expect(c.events.at(-1)?.value).toMatchObject({ outcome: "completed_transport" });
});
it("consumes admission once even after handler failure and never retries", async () => {
  postArtistChatHandler.mockReset();
  postArtistChatHandler.mockRejectedValue(new Error("setup_failed"));
  const c = capture();
  expect((await chatStreamTurn({ artistId: "a1", question: "q" }, fakeClock(), c)).error).toBe(
    "setup_failed",
  );
  expect((await chatStreamTurn({ artistId: "a1", question: "q" }, fakeClock(), c)).error).toBe(
    "already_consumed",
  );
  expect(postArtistChatHandler).toHaveBeenCalledTimes(1);
});
it("rejects missing controls and capture overflow before invoking handler", async () => {
  postArtistChatHandler.mockReset();
  const input = { artistId: "a1", question: "q" };
  expect((await chatStreamTurn(input, fakeClock(), {} as never)).error).toBe(
    "missing_capture_controls",
  );
  expect((await chatStreamTurn(input, fakeClock(), capture(1))).error).toBe("capture_limit");
  expect(postArtistChatHandler).not.toHaveBeenCalled();
});
it.each([
  ["missing finish", textChunks.slice(0, -1), "missing finish"],
  ["abort", [...textChunks.slice(0, 2), { type: "abort" }], "Aborted"],
  [
    "late text",
    [...textChunks, { type: "text-delta", id: "x", delta: "late" }],
    "Chunk after finish",
  ],
  ["empty", [{ type: "finish", finishReason: "stop" }], "no answer"],
] as const)("retains partial evidence and rejects %s", async (_label, chunks, message) => {
  postArtistChatHandler.mockReset();
  postArtistChatHandler.mockResolvedValue(streamOf([...chunks] as UIMessageChunk[]));
  const c = capture();
  const r = await chatStreamTurn({ artistId: "a1", question: "q" }, fakeClock(), c);
  expect(r.error).toContain(message);
  expect(c.events.at(-1)?.value).toMatchObject({ outcome: "failed" });
});
it("retains partial answer on reader failure", async () => {
  postArtistChatHandler.mockReset();
  let n = 0;
  postArtistChatHandler.mockResolvedValue(
    new Response(
      new ReadableStream({
        pull(c) {
          if (n++ === 0)
            c.enqueue(
              new TextEncoder().encode(
                "data: " +
                  JSON.stringify({ type: "text-delta", id: "x", delta: "partial" }) +
                  "\n\n",
              ),
            );
          else c.error(new Error("reader_failed"));
        },
      }),
    ),
  );
  const r = await chatStreamTurn({ artistId: "a1", question: "q" }, fakeClock(), capture());
  expect(r.error).toBe("reader_failed");
  expect(r.answer).toBe("partial");
});
it("returns capture failure even after a valid finish", async () => {
  postArtistChatHandler.mockReset();
  postArtistChatHandler.mockResolvedValue(streamOf(textChunks));
  const c = capture();
  const record = c.record;
  c.record = (kind, value) => {
    if (kind === "terminal") throw new Error("final_capture_failed");
    record(kind, value);
  };
  const r = await chatStreamTurn({ artistId: "a1", question: "q" }, fakeClock(), c);
  expect(r.error).toBe("final_capture_failed");
  expect(r.answer).toBe("Answer [1].");
});

it.each(["length", "error", "tool-calls", undefined] as const)(
  "rejects incomplete finish reason %s",
  async finishReason => {
    postArtistChatHandler.mockReset();
    postArtistChatHandler.mockResolvedValue(
      streamOf([...textChunks.slice(0, -1), { type: "finish", finishReason }]),
    );
    const r = await chatStreamTurn({ artistId: "a1", question: "q" }, fakeClock(), capture());
    expect(r.error).toContain("Incomplete model generation");
    expect(r.answer).toBe("Answer [1].");
  },
);
it("cancels a noncooperating stalled stream and preserves partial text", async () => {
  postArtistChatHandler.mockReset();
  const controller = new AbortController();
  const cancelled = vi.fn();
  postArtistChatHandler.mockResolvedValue(
    new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(
            new TextEncoder().encode(
              "data: " + JSON.stringify({ type: "text-delta", id: "x", delta: "partial" }) + "\n\n",
            ),
          );
        },
        cancel: cancelled,
      }),
    ),
  );
  const c = capture();
  const record = c.record;
  c.record = (kind, value) => {
    record(kind, value);
    if (kind === "ui-chunk") queueMicrotask(() => controller.abort());
  };
  const r = await chatStreamTurn({ artistId: "a1", question: "q" }, fakeClock(), {
    ...c,
    signal: controller.signal,
  });
  expect(r.error).toContain("Aborted");
  expect(r.answer).toBe("partial");
  await vi.waitFor(() => expect(cancelled).toHaveBeenCalledTimes(1));
});
it("stops immediately on error even when stream stays open", async () => {
  postArtistChatHandler.mockReset();
  const cancelled = vi.fn();
  postArtistChatHandler.mockResolvedValue(
    new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(
            new TextEncoder().encode(
              "data: " + JSON.stringify({ type: "error", errorText: "failed" }) + "\n\n",
            ),
          );
        },
        cancel: cancelled,
      }),
    ),
  );
  const r = await chatStreamTurn({ artistId: "a1", question: "q" }, fakeClock(), capture());
  expect(r.error).toBe("failed");
  await vi.waitFor(() => expect(cancelled).toHaveBeenCalledTimes(1));
});
it("rejects question/conversation mismatch before dispatch", async () => {
  postArtistChatHandler.mockReset();
  const r = await chatStreamTurn(
    {
      artistId: "a1",
      question: "q",
      messages: [{ role: "user", parts: [{ type: "text", text: "different" }] }],
    },
    fakeClock(),
    capture(),
  );
  expect(r.error).toBe("question_messages_mismatch");
  expect(postArtistChatHandler).not.toHaveBeenCalled();
});

it("stops on abnormal finish even when transport stays open", async () => {
  postArtistChatHandler.mockReset();
  const cancelled = vi.fn();
  postArtistChatHandler.mockResolvedValue(
    new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(
            new TextEncoder().encode(
              "data: " + JSON.stringify({ type: "finish", finishReason: "length" }) + "\n\n",
            ),
          );
        },
        cancel: cancelled,
      }),
    ),
  );
  const r = await chatStreamTurn({ artistId: "a1", question: "q" }, fakeClock(), capture());
  expect(r.error).toContain("Incomplete model generation: length");
  await vi.waitFor(() => expect(cancelled).toHaveBeenCalledTimes(1));
});

it("does not classify an empty-message terminal capture failure as success", async () => {
  postArtistChatHandler.mockReset();
  postArtistChatHandler.mockResolvedValue(streamOf(textChunks));
  const c = capture();
  const record = c.record;
  c.record = (kind, value) => {
    if (kind === "terminal") throw new Error("");
    record(kind, value);
  };
  const result = await chatStreamTurn({ artistId: "a1", question: "q" }, fakeClock(), c);
  expect(result.answer).toBe("Answer [1].");
  expect(result.error).toBe("capture_failed");
});
