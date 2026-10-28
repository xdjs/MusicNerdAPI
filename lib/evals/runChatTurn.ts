import { askArtistTurn } from "@/lib/evals/askArtistTurn";
import { chatStreamTurn } from "@/lib/evals/chatStreamTurn";
import type { ChatTurn } from "@/lib/evals/ChatTurn";

/**
 * One chat turn on the selected target, so the same cases and scorers measure today's
 * path and its replacement (xdjs/MusicNerdWeb#1629). `askArtist` is today's job relay;
 * `chat` is the streaming chat endpoint.
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
  if (target === "chat") return chatStreamTurn(input);
  throw new Error(`Unknown CHAT_EVAL_TARGET "${target}"`);
}
