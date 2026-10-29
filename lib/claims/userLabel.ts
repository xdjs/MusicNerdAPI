import { getUserById } from "@/lib/users/getUserById";

/**
 * How a team notification names a user: their email, else their id. Never
 * throws, so a notification can't fail the request that sends it.
 *
 * @param userId - The user.
 * @returns The email, or the id.
 */
export async function userLabel(userId: string): Promise<string> {
  try {
    return (await getUserById(userId))?.email ?? userId;
  } catch {
    return userId;
  }
}
