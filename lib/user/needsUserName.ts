/**
 * Whether a user still needs a real user name: none set, an email address, or
 * their own wallet address.
 *
 * @param user - The user's current name and wallet.
 * @param user.username - The user name.
 * @param user.wallet - The wallet address.
 * @returns True when the name can't be shown publicly.
 */
export function needsUserName(user: { username?: string | null; wallet?: string | null }): boolean {
  const name = user.username?.trim() ?? "";
  return (
    !name ||
    /[^\s@]+@[^\s@]+/.test(name) ||
    name.toLowerCase() === user.wallet?.trim().toLowerCase()
  );
}
