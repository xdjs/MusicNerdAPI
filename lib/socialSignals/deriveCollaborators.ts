import type { SocialPostRow } from "@/lib/instagram/types";
import { normalizeHandle } from "@/lib/instagram/normalizeHandle";
import { pushEvidence } from "@/lib/socialSignals/pushEvidence";
import type { Collaborator } from "@/lib/socialSignals/types";

/**
 * Collaborators: coauthor tags, and posts by someone else on the artist's
 * feed. Both are mutual, Instagram-accepted collaborations, unlike a mention.
 * The artist's own handle never counts, even if a stored row still holds it.
 *
 * @param posts - The posts to read.
 * @param handle - The artist's Instagram handle.
 * @returns Collaborators, most posts first, then by handle.
 */
export function deriveCollaborators(posts: SocialPostRow[], handle: string): Collaborator[] {
  const self = normalizeHandle(handle);
  const byHandle = new Map<string, Collaborator>();

  for (const post of posts) {
    const handles = post.isOwnPost ? post.coauthors : [...post.coauthors, post.ownerUsername];
    for (const rawHandle of handles) {
      const key = normalizeHandle(rawHandle);
      if (!key || key === self) continue;
      const entry = byHandle.get(key) ?? {
        handle: rawHandle.trim().replace(/^@/, ""),
        postCount: 0,
        evidenceUrls: [],
      };
      entry.postCount += 1;
      pushEvidence(entry.evidenceUrls, post.url);
      byHandle.set(key, entry);
    }
  }

  return [...byHandle.values()].sort(
    (a, b) => b.postCount - a.postCount || a.handle.localeCompare(b.handle),
  );
}
