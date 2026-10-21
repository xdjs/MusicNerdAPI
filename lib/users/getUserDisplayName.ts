import { needsUserName } from "@/lib/users/needsUserName";

/**
 * The name shown in public credits: the chosen name, or `Anonymous` while
 * one is still pending, so an email or wallet never leaks as a name.
 *
 * @param user - The account's name, email and wallet.
 * @param user.username - The chosen name.
 * @param user.email - The email.
 * @param user.wallet - The wallet address.
 * @returns The trimmed chosen name, or `Anonymous`.
 */
export function getUserDisplayName(user: {
  username?: string | null;
  email?: string | null;
  wallet?: string | null;
}): string {
  return needsUserName(user) ? "Anonymous" : user.username!.trim();
}
