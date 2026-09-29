import type { SocialPostRow } from "@/lib/instagram/types";
import { MAX_COLLABORATOR_SOURCES, MAX_MUSIC_REF_SOURCES } from "@/lib/lore/const";
import type { DocMaterial } from "@/lib/lore/types";
import { deriveCollaborators } from "@/lib/socialSignals/deriveCollaborators";
import { deriveMusicReferences } from "@/lib/socialSignals/deriveMusicReferences";
import { nameTokens } from "@/lib/socialSignals/nameTokens";
import { selectRecentPosts } from "@/lib/socialSignals/selectRecentPosts";

/**
 * Social signals worth citing: confirmed Instagram collaborations (coauthor
 * tags, collaborators' posts) and track credits naming the artist, from recent
 * posts. Collaborators are capped tight, most-repeated first: a bare handle
 * says nothing about what the collaboration was.
 *
 * @param posts - The artist's stored posts.
 * @param handle - The artist's Instagram handle.
 * @param artistName - The artist's name.
 * @returns Collaborators and track credits, each with its first evidence URL.
 */
export function socialSignalSources(
  posts: SocialPostRow[],
  handle: string,
  artistName: string,
): Pick<DocMaterial, "socialCollaborators" | "socialMusicRefs"> {
  const recent = selectRecentPosts(posts);
  const socialCollaborators = deriveCollaborators(recent, handle)
    .filter(c => c.evidenceUrls[0])
    .slice(0, MAX_COLLABORATOR_SOURCES)
    .map(c => ({ handle: c.handle, url: c.evidenceUrls[0] }));
  const socialMusicRefs = deriveMusicReferences(recent, nameTokens(artistName))
    .filter(m => m.evidenceUrls[0])
    .slice(0, MAX_MUSIC_REF_SOURCES)
    .map(m => ({ title: m.title, artist: m.artist, url: m.evidenceUrls[0] }));
  return { socialCollaborators, socialMusicRefs };
}
