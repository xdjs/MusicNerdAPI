import { ilike } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { users } from "@/lib/db/schema";
import { withDbRetry } from "@/lib/db/withDbRetry";

/**
 * The account that owns a wallet, matched case-insensitively.
 *
 * @param wallet - The wallet address.
 * @returns The user row, or undefined; a database error throws `Error finding user: …`.
 */
export async function getUserByWallet(wallet: string) {
  try {
    // Normalize wallet address to lowercase for consistent lookups
    const normalizedWallet = wallet.toLowerCase();
    return await withDbRetry(() =>
      db.query.users.findFirst({ where: ilike(users.wallet, normalizedWallet) }),
    );
  } catch (error) {
    console.error("error getting user by wallet", error);
    if (error instanceof Error) {
      throw new Error(`Error finding user: ${error.message}`);
    }
    throw new Error("Error finding user: Unknown error");
  }
}
