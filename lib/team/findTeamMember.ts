import { parseTeamMembers } from "@/lib/team/parseTeamMembers";

/**
 * The team member an email belongs to, from `TEAM_ALLOWED_EMAILS`.
 *
 * @param email - A verified email.
 * @returns The member's name, or null when the email isn't on the team.
 */
export function findTeamMember(email: string): string | null {
  return parseTeamMembers(process.env.TEAM_ALLOWED_EMAILS).get(email.toLowerCase()) ?? null;
}
