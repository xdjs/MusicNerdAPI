import { approveContributorSubmission } from "@/lib/contributorApprovals/approveContributorSubmission";
import type { ContributorSubmission } from "@/lib/contributorApprovals/types";
import { queueLoreRefresh } from "@/lib/research/queueLoreRefresh";

/**
 * Approves each distinct submission on its own, so one failure leaves the
 * rest approved, then queues one Lore refresh per artist that gained an
 * approved source.
 *
 * @param adminId - The reviewing admin.
 * @param contributorId - The contributor.
 * @param items - The submissions.
 * @returns The approved, skipped and failed counts, and a warning when a refresh could not start.
 */
export async function approveContributorSubmissions(
  adminId: string,
  contributorId: string,
  items: ContributorSubmission[],
): Promise<{ approved: number; skipped: number; failed: number; warning?: string }> {
  let approved = 0,
    skipped = 0,
    failed = 0;
  const refreshes = new Map<string, string | null>();
  const unique = new Map(items.map(item => [`${item.type}:${item.id}`, item]));
  for (const item of unique.values()) {
    try {
      const result = await approveContributorSubmission(adminId, contributorId, item);
      if (!result) {
        skipped++;
        continue;
      }
      approved++;
      if (result.lore) refreshes.set(result.artistId, result.claimId);
    } catch (error) {
      console.error("[admin/users/submissions] Item not approved", { id: item.id, error });
      failed++;
    }
  }
  let refreshFailures = 0;
  for (const [artistId, claimId] of refreshes) {
    try {
      await queueLoreRefresh(artistId, claimId, { userId: adminId, trigger: "admin_bulk_review" });
    } catch (error) {
      refreshFailures++;
      console.error("[admin/users/submissions] Lore enqueue failed", error);
    }
  }
  return {
    approved,
    skipped,
    failed,
    ...(refreshFailures
      ? {
          warning: `Approvals saved. Lore refresh could not start for ${refreshFailures} artist(s); use Look again on those profiles to retry.`,
        }
      : {}),
  };
}
