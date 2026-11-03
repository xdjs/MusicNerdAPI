import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { users } from "@/lib/db/schema";
/** Admission check only; first insertion rechecks/locks submission-time trust. */
export async function isTrustedLoreContributor(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { isAdmin: true, isWhiteListed: true },
  });
  return !!(user?.isAdmin || user?.isWhiteListed);
}
