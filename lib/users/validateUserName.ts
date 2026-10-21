/**
 * Why a requested user name cannot be saved. Ported from MusicNerdWeb's
 * `validateUserName`.
 *
 * @param value - The requested name, as sent.
 * @returns The message to show, or null when the name is acceptable.
 */
export function validateUserName(value: unknown): string | null {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) return "User name is required.";
  if (name.length > 50) return "User name must be 50 characters or less.";
  if (/[\x00-\x1F\x7F]/.test(name)) return "User name contains invalid characters.";
  if (name.includes("@") || /^0x[a-f0-9]{40}$/i.test(name))
    return "Choose a user name instead of an email or wallet address.";
  return null;
}
