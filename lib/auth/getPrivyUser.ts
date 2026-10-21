import { getPrivyClient } from "@/lib/auth/getPrivyClient";

/**
 * The Privy account, with its linked wallets and emails.
 *
 * @param privyUserId - The Privy user id.
 * @returns The Privy user, or null when Privy can't be reached or rejects the id.
 */
export async function getPrivyUser(privyUserId: string) {
  try {
    return await getPrivyClient().getUser(privyUserId);
  } catch (error) {
    console.error("[Privy] Failed to get user:", error);
    return null;
  }
}
