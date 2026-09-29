import { MIN_CAPTION_CHARS } from "@/lib/credits/const";
import type { SocialPostRow } from "@/lib/instagram/types";

/**
 * Posts worth sending to the model: the artist's own, with prose in them. A
 * caption someone else wrote is not the artist's statement.
 *
 * @param posts - Stored posts.
 * @returns The own posts with at least a short sentence once hashtags and padding are gone.
 */
export function captionBearingPosts(posts: SocialPostRow[]): SocialPostRow[] {
  return posts.filter(p => {
    if (!p.isOwnPost) return false;
    const caption = (p.caption ?? "")
      .replace(/#\w+/g, "")
      .replace(/[\s.·]+/g, " ")
      .trim();
    return caption.length >= MIN_CAPTION_CHARS;
  });
}
