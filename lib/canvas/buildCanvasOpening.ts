import type { CanvasEvidence } from "./const";
/** Derive the invitation and reply chips from the same readable source choices. */
export function buildCanvasOpening(evidence: CanvasEvidence[]) {
  const candidates = evidence.filter(
    item =>
      !item.id.startsWith("public_profile:") && item.category !== "identity" && item.text.trim(),
  );
  const work = candidates.find(item => item.workUrl || item.category === "release");
  const discography = candidates.find(item => /\/discography\/?$/.test(new URL(item.url).pathname));
  const document = candidates.find(item => item.category === "document" && item.id !== work?.id);
  const social = candidates.find(item => item.mediaKind === "instagram");
  const ordered = [work, discography, document, social, ...candidates].filter(
    (item, index, all): item is CanvasEvidence =>
      !!item && all.findIndex(other => other?.id === item.id) === index,
  );
  const openingSuggestions = ordered.slice(0, 2).map(item => {
    const path = new URL(item.url).pathname;
    const subject =
      item.mediaKind === "instagram"
        ? "this Instagram post"
        : /\/discography\/?$/.test(path)
          ? "the discography"
          : /\/gallery\/?$/.test(path)
            ? "the photo gallery"
            : item.title === new URL(item.url).hostname ||
                item.title === new URL(item.url).hostname.replace(/^www\./, "")
              ? "this website"
              : item.title;
    return {
      subject,
      label: `Explore ${subject}`.slice(0, 80),
      prompt: `Help me explore ${subject} (${item.url}). Start with what this source actually tells us, then suggest one grounded next thread.`,
    };
  });
  return {
    openingIds: ordered.slice(0, 3).map(item => item.id),
    openingSuggestions,
    openingQuestion:
      openingSuggestions.length === 2
        ? `Shall we explore ${openingSuggestions[0].subject}, or ${openingSuggestions[1].subject}?`
        : openingSuggestions.length === 1
          ? `Want to explore ${openingSuggestions[0].subject} together?`
          : "Want to start with the artist’s profile links?",
  };
}
