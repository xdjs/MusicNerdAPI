/**
 * An agent's name as the board takes it in a profile: lowercase letters,
 * numbers, `-` and `_`, at most 32 characters.
 *
 * @param name - What the member typed, like "Claude Duet".
 * @returns The cleaned name ("claude-duet"), or null when nothing usable is left.
 */
export function toAgentName(name: string): string | null {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return cleaned || null;
}
