import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { users } from "@/lib/db/schema";

/**
 * A user's whole row, with camelCase fields; GET /api/user/{id} returns it as is.
 *
 * @param id - The user id.
 * @returns The row, or undefined when there is none; throws on a database error.
 */
export async function getUserById(id: string) {
  try {
    return await db.query.users.findFirst({ where: eq(users.id, id) });
  } catch (error) {
    console.error("error getting user by Id", error);
    throw new Error(
      `Error finding user: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
