import { getAgentBreakdown } from "@/lib/agentWork/getAgentBreakdown";
import { getAuditLog } from "@/lib/agentWork/getAuditLog";
import { getExclusionsByPlatform } from "@/lib/agentWork/getExclusionsByPlatform";
import { getRunHistory } from "@/lib/agentWork/getRunHistory";
import type { AgentWorkDetails } from "@/lib/agentWork/types";

/**
 * The Agent Work tab's heavy details, loaded on demand. Run one after another
 * so they don't saturate the connection pool shared with MusicNerdWeb.
 *
 * @param auditPage - The audit log page.
 * @param auditLimit - Audit log rows per page.
 * @returns The audit log, agent breakdown, exclusions and run history.
 */
export async function getAgentWorkDetails(
  auditPage = 1,
  auditLimit = 50,
): Promise<AgentWorkDetails> {
  const auditLog = await getAuditLog(auditPage, auditLimit);
  const agentBreakdown = await getAgentBreakdown();
  const exclusions = await getExclusionsByPlatform();
  const runHistory = await getRunHistory();
  return { auditLog, agentBreakdown, exclusions, runHistory };
}
