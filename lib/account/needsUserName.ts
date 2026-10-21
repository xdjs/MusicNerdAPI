/**
 * Whether the user still needs to choose a name: none, an email, or the wallet
 * address used as a name.
 *
 * @param user - The user's name and wallet.
 * @returns True when the user has no real name yet.
 */
export function needsUserName(user: { username?: string | null; wallet?: string | null }): boolean {
  const name = user.username?.trim() ?? "";
  return (
    !name ||
    /[^\s@]+@[^\s@]+/.test(name) ||
    name.toLowerCase() === user.wallet?.trim().toLowerCase()
  );
}
