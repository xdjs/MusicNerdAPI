/**
 * Reads the team list, written as `name=email` pairs separated by commas
 * (`sweetman=a@example.com,cy=b@example.com`).
 *
 * @param value - The list, usually `TEAM_ALLOWED_EMAILS`.
 * @returns Each member's name, by lowercased email.
 */
export function parseTeamMembers(value: string | undefined): Map<string, string> {
  const members = new Map<string, string>();
  for (const pair of (value ?? "").split(",")) {
    const [name, email] = pair.split("=").map(part => part.trim());
    if (name && email) members.set(email.toLowerCase(), name);
  }
  return members;
}
