import type { SocialPostRow } from "@/lib/instagram/types";
import { creditIncludesArtist } from "@/lib/socialSignals/creditIncludesArtist";
import { pushEvidence } from "@/lib/socialSignals/pushEvidence";
import type { MusicReference } from "@/lib/socialSignals/types";

/**
 * Track credits that are plausibly the artist's own work, from their posts or
 * collaborators' alike. Evidence is only ever the posts carrying that exact
 * title and artist.
 *
 * @param posts - The posts to read.
 * @param artistNameTokens - The artist's name words, from `nameTokens`.
 * @returns References, most evidence first, then by title.
 */
export function deriveMusicReferences(
  posts: SocialPostRow[],
  artistNameTokens: Set<string>,
): MusicReference[] {
  const byKey = new Map<string, MusicReference>();
  for (const post of posts) {
    if (!post.musicTitle || !post.musicArtist) continue;
    if (!creditIncludesArtist(post.musicArtist, artistNameTokens)) continue;
    const key = `${post.musicTitle.toLowerCase()}::${post.musicArtist.toLowerCase()}`;
    const entry = byKey.get(key) ?? {
      title: post.musicTitle,
      artist: post.musicArtist,
      evidenceUrls: [],
      postedByOwn: false,
      ownerUsername: post.ownerUsername,
    };
    pushEvidence(entry.evidenceUrls, post.url);
    entry.postedByOwn = entry.postedByOwn || post.isOwnPost;
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort(
    (a, b) => b.evidenceUrls.length - a.evidenceUrls.length || a.title.localeCompare(b.title),
  );
}
