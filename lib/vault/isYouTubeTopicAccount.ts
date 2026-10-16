/**
 * Recognizes YouTube's explicitly named auto-generated Topic channels, not an
 * artist-controlled channel whose body happens to discuss a topic.
 *
 * @param siteName - Parsed account platform.
 * @param title - Fetched channel name/title, never a search snippet.
 * @returns Whether the account title explicitly identifies a Topic channel.
 */
export function isYouTubeTopicAccount(siteName: string, title: string | null | undefined): boolean {
  return (
    ["youtube", "youtubechannel"].includes(siteName) &&
    /\s[-–—]\s*Topic(?:\s*[-|–—]\s*YouTube)?\s*$/i.test(title ?? "")
  );
}
