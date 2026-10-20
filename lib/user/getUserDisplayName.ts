import { needsUserName } from "@/lib/user/needsUserName";

/**
 * Safe public display name for a user.
 *
 * @param user - The user record.
 * @returns The username or "Anonymous" when one has not been assigned yet.
 */
export function getUserDisplayName(user: {
  username?: string | null;
  email?: string | null;
  wallet?: string | null;
}): string {
  return needsUserName(user) ? "Anonymous" : user.username!.trim();
}
