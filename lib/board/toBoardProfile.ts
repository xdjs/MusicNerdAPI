const MAX_LENGTH = 32;

const clean = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * The board profile an agent posts as, `<agent>-<member>` (xdjs/MusicNerdWeb#1696):
 * lowercase letters, numbers, `-` and `_`, at most 32 characters. The agent
 * is shortened to fit, so the member's name is always whole.
 *
 * @param agent - The name the client registered with, like "Claude Code".
 * @param member - The team member who connected it, like "sweetman".
 * @returns The profile, like "claude-code-sweetman".
 */
export function toBoardProfile(agent: string, member: string): string {
  const who = clean(member);
  const what =
    clean(agent)
      .slice(0, MAX_LENGTH - who.length - 1)
      .replace(/-+$/, "") || "agent";
  return `${what}-${who}`;
}
