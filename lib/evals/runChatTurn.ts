import { askArtistTurn } from "@/lib/evals/askArtistTurn";
import type { ChatTurn } from "@/lib/evals/ChatTurn";

/**
 * One chat turn on the selected target, so the same cases and scorers measure today's
 * path and its replacement (xdjs/MusicNerdWeb#1629). `askArtist` is today's job relay;
 * the streaming chat endpoint adds its target here when it is built.
 *
 * @param target - `CHAT_EVAL_TARGET`, `askArtist` by default.
 * @param input - The case.
 * @param input.artistId - The artist's id.
 * @param input.question - The fan's question.
 * @returns The turn.
 */
export async function runChatTurn(
  target: string,
  input: { artistId: string; question: string },
): Promise<ChatTurn> {
  if (target === "askArtist") return askArtistTurn(input);
  throw new Error(`Unknown CHAT_EVAL_TARGET "${target}"`);
}
