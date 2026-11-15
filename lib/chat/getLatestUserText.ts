/** The longest question text passed to a search, like the `searchPassages` query limit. */
const MAX_QUESTION_CHARS = 300;

/**
 * The text of the latest user message of a chat, so the first search of an answer can also search
 * the user's own wording (see `createSearchPassagesTool`). The `text` parts of the last message
 * whose role is `user`, joined by newlines (as `validateArtistChatBody` reads the question), cut to
 * 300 characters on a code-point boundary.
 *
 * @param messages - The chat's messages, oldest first.
 * @returns The text; empty when no user message has any.
 */
export function getLatestUserText(
  messages: { role: string; parts: { type?: string; text?: string }[] }[],
): string {
  const last = messages.findLast(message => message.role === "user");
  const text = (last?.parts ?? [])
    .flatMap(part =>
      typeof part.text === "string" && (part.type ?? "text") === "text" ? [part.text] : [],
    )
    .join("\n");
  return Array.from(text).slice(0, MAX_QUESTION_CHARS).join("");
}
