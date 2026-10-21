/**
 * Whether an account still needs a chosen name: none, an email used as one,
 * or the wallet address repeated as one, as MusicNerdWeb decides it.
 *
 * @param user - The account's name and wallet.
 * @param user.username - The chosen name.
 * @param user.wallet - The wallet address.
 * @returns True when the account has no usable public name.
 */
export function needsUserName(user: { username?: string | null; wallet?: string | null }): boolean {
  const name = user.username?.trim() ?? "";
  return (
    !name ||
    /[^\s@]+@[^\s@]+/.test(name) ||
    name.toLowerCase() === user.wallet?.trim().toLowerCase()
  );
}
