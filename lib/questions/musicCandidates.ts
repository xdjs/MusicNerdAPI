import { TOP_MUSIC } from "@/lib/questions/const";
import { slug } from "@/lib/questions/slug";
import type { SignalCandidate } from "@/lib/questions/types";
import type { MusicReference } from "@/lib/socialSignals/types";

/**
 * Tracks credited to the artist on posts. A track on somebody else's post is
 * labelled with that account and never framed as the artist's own post.
 *
 * @param artistName - The artist.
 * @param musicReferences - The music references derived from the posts.
 * @returns The TOP_MUSIC with the most posts.
 */
export function musicCandidates(
  artistName: string,
  musicReferences: MusicReference[],
): SignalCandidate[] {
  return [...musicReferences]
    .sort((a, b) => b.evidenceUrls.length - a.evidenceUrls.length)
    .slice(0, TOP_MUSIC)
    .map(m => ({
      signalId: `music_${slug(m.title)}_${slug(m.artist)}`,
      kind: "music",
      key: `social_music_${slug(m.title)}_${slug(m.artist)}`,
      authoredBy: m.postedByOwn ? "artist" : `@${m.ownerUsername}`,
      material: m.postedByOwn
        ? `${artistName} tagged the track "${m.title}" by ${m.artist} on their own Instagram post.`
        : `The track "${m.title}" by ${m.artist} appears on a post from @${m.ownerUsername} that ${artistName} is connected to (NOT ${artistName}'s own post).`,
      sourceUrls: m.evidenceUrls,
    }));
}
