import { eq } from "drizzle-orm";
import { WALLET_ADDRESS_REGEX } from "@/lib/account/const";
import { db } from "@/lib/db/db";
import { users } from "@/lib/db/schema";

/**
 * Writes the wallet, lower-cased, on the account.
 *
 * @param userId - The account.
 * @param walletAddress - The wallet address.
 * @returns The updated user row.
 */
export async function linkWalletToUser(userId: string, walletAddress: string) {
  // Validate wallet address format
  if (!WALLET_ADDRESS_REGEX.test(walletAddress)) {
    throw new Error("Invalid wallet address format");
  }

  try {
    const now = new Date().toISOString();
    const [updatedUser] = await db
      .update(users)
      .set({ wallet: walletAddress.toLowerCase(), updatedAt: now })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  } catch (e) {
    console.error("error linking wallet to user", e);
    throw new Error("Error linking wallet to user");
  }
}
