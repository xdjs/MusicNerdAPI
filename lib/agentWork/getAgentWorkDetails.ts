import { getAgentBreakdown } from "@/lib/agentWork/getAgentBreakdown";
import { getAuditLog } from "@/lib/agentWork/getAuditLog";
import { getExclusionsByPlatform } from "@/lib/agentWork/getExclusionsByPlatform";
import { getRunHistory } from "@/lib/agentWork/getRunHistory";
import type { AgentWorkDetails } from "@/lib/agentWork/types";

/**
 * The heavy details the Agent work tab loads on demand. Sequential, not
 * concurrent, to avoid saturating the shared Supabase connection pool.
 *
 * @param auditPage - The audit log page.
 * @param auditLimit - Audit log entries per page.
 * @returns The audit log page, agent breakdown, exclusions and run history.
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
