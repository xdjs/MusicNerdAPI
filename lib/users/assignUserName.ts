import { needsUserName } from "@/lib/users/needsUserName";
import { setUserName } from "@/lib/users/setUserName";

/**
 * Gives an account without a usable public name a generated one, as
 * MusicNerdWeb's sign-in did. Naming is optional, so a failure never fails
 * the caller: it answers no name (never the email or wallet) and the next
 * call tries again.
 *
 * @param user - The account's row, or at least its id, name and wallet.
 * @returns The row with the assigned name, or unchanged when it already has one.
 */
export async function assignUserName<
  T extends { id: string; username: string | null; wallet: string | null },
>(user: T): Promise<T & { usernameNeedsConfirmation?: boolean }> {
  if (!needsUserName(user)) return user;
  try {
    return { ...user, ...(await setUserName(user.id)) };
  } catch {
    console.warn("[API] user name assignment deferred; the next call retries");
    return { ...user, username: null };
  }
}
