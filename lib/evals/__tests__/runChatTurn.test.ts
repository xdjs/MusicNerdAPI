import { describe, it, expect, vi } from "vitest";

const askArtistTurn = vi.fn();
vi.mock("@/lib/evals/askArtistTurn", () => ({
  askArtistTurn: (...a: unknown[]) => askArtistTurn(...a),
}));
const chatStreamTurn = vi.fn();
vi.mock("@/lib/evals/chatStreamTurn", () => ({
  chatStreamTurn: (...a: unknown[]) => chatStreamTurn(...a),
}));
const { runChatTurn } = await import("@/lib/evals/runChatTurn");

describe("runChatTurn", () => {
  it("runs the askArtist target", async () => {
    askArtistTurn.mockResolvedValueOnce({ answer: "a", sources: [], firstTextMs: 1, totalMs: 1 });
    const input = { artistId: "x", question: "q" };
    expect(await runChatTurn("askArtist", input)).toEqual({
      answer: "a",
      sources: [],
      firstTextMs: 1,
      totalMs: 1,
    });
    expect(askArtistTurn).toHaveBeenCalledWith(input);
  });

  it("runs the streaming chat target", async () => {
    chatStreamTurn.mockResolvedValueOnce({ answer: "b", sources: [], firstTextMs: 1, totalMs: 2 });
    const input = { artistId: "x", question: "q" };
    expect(await runChatTurn("chat", input)).toMatchObject({ answer: "b", totalMs: 2 });
    expect(chatStreamTurn).toHaveBeenCalledWith(input);
  });

  it("refuses an unknown target", async () => {
    await expect(runChatTurn("nope", { artistId: "x", question: "q" })).rejects.toThrow(
      'Unknown CHAT_EVAL_TARGET "nope"',
    );
  });
});
