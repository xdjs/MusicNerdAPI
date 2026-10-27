import { describe, it, expect, vi } from "vitest";

const askArtistTurn = vi.fn();
vi.mock("@/lib/evals/askArtistTurn", () => ({
  askArtistTurn: (...a: unknown[]) => askArtistTurn(...a),
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

  it("refuses a target that does not exist yet", async () => {
    await expect(runChatTurn("chat", { artistId: "x", question: "q" })).rejects.toThrow(
      'Unknown CHAT_EVAL_TARGET "chat"',
    );
  });
});
