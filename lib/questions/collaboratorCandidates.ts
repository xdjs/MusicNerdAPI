import { TOP_COLLABORATORS } from "@/lib/questions/const";
import { slug } from "@/lib/questions/slug";
import type { SignalCandidate } from "@/lib/questions/types";
import type { Collaborator } from "@/lib/socialSignals/types";

/**
 * Mutual Instagram collaborations (coauthored or cross-posted). Labelled with
 * the other account, because the material can be somebody else's post.
 *
 * @param artistName - The artist.
 * @param collaborators - The collaborators derived from the posts.
 * @returns The TOP_COLLABORATORS with the most posts.
 */
export function collaboratorCandidates(
  artistName: string,
  collaborators: Collaborator[],
): SignalCandidate[] {
  return [...collaborators]
    .sort((a, b) => b.postCount - a.postCount)
    .slice(0, TOP_COLLABORATORS)
    .map(c => ({
      signalId: `collab_${slug(c.handle)}`,
      kind: "collaborator",
      key: `social_collaborator_${slug(c.handle)}`,
      authoredBy: `@${c.handle}`,
      material: `${artistName} has collaborated with / appeared in posts with @${c.handle} across ${c.postCount} Instagram post(s). This is a real, mutual collaboration (co-authored or cross-posted), not a one-way mention.`,
      sourceUrls: c.evidenceUrls,
    }));
}
