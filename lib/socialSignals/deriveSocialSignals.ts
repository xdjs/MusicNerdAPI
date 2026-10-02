import type { SocialPostRow } from "@/lib/instagram/types";
import { deriveCollaborators } from "@/lib/socialSignals/deriveCollaborators";
import { deriveMusicReferences } from "@/lib/socialSignals/deriveMusicReferences";
import { deriveStandoutPosts } from "@/lib/socialSignals/deriveStandoutPosts";
import { deriveThemes } from "@/lib/socialSignals/deriveThemes";
import { nameTokens } from "@/lib/socialSignals/nameTokens";
import { selectRecentPosts } from "@/lib/socialSignals/selectRecentPosts";
import type { SocialSignals } from "@/lib/socialSignals/types";

/**
 * The signals interview questions are built from, derived from recent
 * activity. Standouts are measured against the same recent posts, so a post
 * stands out against what the artist does now.
 *
 * @param allPosts - Every stored post.
 * @param handle - The artist's Instagram handle.
 * @param artistName - The artist's name, to recognise their own tracks and drop self-naming.
 * @returns Collaborators, themes, standout posts and music references.
 */
export function deriveSocialSignals(
  allPosts: SocialPostRow[],
  handle: string,
  artistName?: string,
): SocialSignals {
  const artistNameTokens = nameTokens(artistName ?? "");
  const posts = selectRecentPosts(allPosts);
  return {
    collaborators: deriveCollaborators(posts, handle),
    themes: deriveThemes(posts, artistNameTokens),
    standoutPosts: deriveStandoutPosts(posts),
    musicReferences: deriveMusicReferences(posts, artistNameTokens),
  };
}
