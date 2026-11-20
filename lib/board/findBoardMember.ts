import { parseBoardMembers } from "@/lib/board/parseBoardMembers";

/**
 * The team member an email belongs to, from `BOARD_ALLOWED_EMAILS`.
 *
 * @param email - A verified email.
 * @returns The member's board name, or null when the email isn't on the team.
 */
export function findBoardMember(email: string): string | null {
  return parseBoardMembers(process.env.BOARD_ALLOWED_EMAILS).get(email.toLowerCase()) ?? null;
}
