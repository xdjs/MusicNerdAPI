import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { rowsOf } from "@/lib/db/rowsOf";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import type { TransactionDb } from "@/lib/ownership/types";
/** Original unclaimed admin authority; whitelist is never profile-edit permission. */
export async function withAdminProfileWrite<T>(
  artistId: string,
  userId: string,
  write: (tx: TransactionDb) => Promise<T>,
): Promise<T> {
  return db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    const [user] = rowsOf(
      await tx.execute(sql`select is_admin from users where id=${userId}::uuid for share`),
    ) as { is_admin: boolean }[];
    if (!user?.is_admin) throw new OwnershipChangedError();
    return write(tx);
  });
}
