/**
 * Reads the team list, written as `name=email` pairs separated by commas
 * (`sweetman=a@example.com,cy=b@example.com`).
 *
 * @param value - The list, usually `BOARD_ALLOWED_EMAILS`.
 * @returns Each member's board name, by lowercased email.
 */
export function parseBoardMembers(value: string | undefined): Map<string, string> {
  const members = new Map<string, string>();
  for (const pair of (value ?? "").split(",")) {
    const [name, email] = pair.split("=").map(part => part.trim());
    if (name && email) members.set(email.toLowerCase(), name);
  }
  return members;
}
