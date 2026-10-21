import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { users } from "@/lib/db/schema";
import { withDbRetry } from "@/lib/db/withDbRetry";

/**
 * The account with this id.
 *
 * @param id - The user id.
 * @returns The user row, or undefined; a database error throws `Error finding user: …`.
 */
export async function getUserById(id: string) {
  try {
    return await withDbRetry(() => db.query.users.findFirst({ where: eq(users.id, id) }));
  } catch (error) {
    console.error("error getting user by Id", error);
    if (error instanceof Error) {
      throw new Error(`Error finding user: ${error.message}`);
    }
    throw new Error("Error finding user: Unknown error");
  }
}
