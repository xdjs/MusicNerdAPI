/**
 * Whether a user still needs a display name assigned.
 *
 * @param user - The user record.
 * @returns `true` when the username is missing, is an email, or matches the wallet.
 */
export function needsUserName(user: { username?: string | null; wallet?: string | null }): boolean {
  const name = user.username?.trim() ?? "";
  return (
    !name ||
    /[^\s@]+@[^\s@]+/.test(name) ||
    name.toLowerCase() === user.wallet?.trim().toLowerCase()
  );
}
