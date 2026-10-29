import { projectCanvasSourceText } from "./projectCanvasSourceText";
import { findCanvasBodyStart } from "./findCanvasBodyStart";
import { getSourceTitle } from "@/lib/chat/getSourceTitle";
import { selectCanvasPassageOffset } from "./selectCanvasPassageOffset";
import type { CanvasEvidence, CanvasResearchOriginal } from "./const";
/** Adapt stored source metadata into a readable, bounded excerpt without inventing facts. */
export function buildCanvasEvidence(
  source: CanvasResearchOriginal,
  focus: string | number = "",
): CanvasEvidence | null {
  let url: URL;
  try {
    url = new URL(source.url);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  const projected = projectCanvasSourceText(source.text, source.url);
  const text = projected.text;
  let title = projected.title ?? getSourceTitle(source.url);
  let attribution = projected.attribution ?? "Stored public source";
  if (url.hostname.endsWith("instagram.com"))
    attribution =
      source.evidenceKind === "provider_transcript"
        ? "Instagram · stored provider transcript"
        : "Instagram · stored caption";
  else if (source.sourceId.startsWith("public_answer:"))
    attribution = "Published interview · question and response";
  if (source.sourceId.startsWith("public_profile:")) {
    title = "Music Nerd · public artist introduction";
    attribution = "Public Music Nerd profile";
  }
  if (!projected.title && /\/(discography|gallery)\/?$/.test(url.pathname))
    title = url.pathname.includes("discography") ? "Discography" : "Photo gallery";
  if (source.pdf) {
    title = source.pdf.title;
    attribution = "Published Lore PDF · extracted page";
  }
  // Skip this verified archive's repeated page/section heading only for new selection.
  // Keep original text and offsets intact, so citations and old excerpts rehydrate exactly.
  const archiveHeader = source.sourceId.startsWith("public_pdf:dutch-archive:")
    ? text.match(
        /Dutchyyy vs The Algorithms \(Excerpt\)\s+The Creation of Evolving Portals and Long-Form Art\s+/,
      )
    : null;
  const headerStart = archiveHeader?.index ?? -1;
  const bodyStart = headerStart + (archiveHeader?.[0].length ?? 0);
  let offset =
    typeof focus === "number"
      ? Math.max(0, focus)
      : selectCanvasPassageOffset(text, focus || (source.pdf ? "" : title));
  if (typeof focus !== "number" && archiveHeader && offset >= headerStart && offset < bodyStart)
    offset = bodyStart + selectCanvasPassageOffset(text.slice(bodyStart), focus || title);
  if (!source.pdf && !projected.metadata && typeof focus !== "number")
    offset = Math.max(offset, findCanvasBodyStart(text));
  // Move to a real word boundary, including when rehydrating an older excerpt offset.
  while (
    offset > 0 &&
    offset < text.length &&
    /\S/.test(text[offset - 1]) &&
    /\S/.test(text[offset])
  )
    offset++;
  while (offset < text.length && /\s/.test(text[offset])) offset++;
  const speakerHeading = [...text.matchAll(/(?:Preface|Foreword) \(by [^\n]+/g)]
    .filter(match => match.index! <= offset)
    .at(-1);
  if (typeof focus !== "number" && speakerHeading && offset - speakerHeading.index! < 60)
    offset = speakerHeading.index!;
  const leadingFragment = text.slice(offset).match(/^(?:\S+\s+){0,2}\S+[.!?]\s+/);
  if (typeof focus !== "number" && leadingFragment && !speakerHeading)
    offset += leadingFragment[0].length;
  const words = (text.slice(offset).match(/\S+/g) ?? []).slice(0, 25);
  const navigationEnd = words.findIndex(
    (word, index) =>
      index >= 4 &&
      (/^(license|tags|checkout|pre-order)$/i.test(word) ||
        (/^view$/i.test(word) && /^fullsize$/i.test(words[index + 1] ?? ""))),
  );
  const bounded = words.slice(0, navigationEnd >= 0 ? navigationEnd : undefined);
  const lastSentence = bounded.findLastIndex(
    (word, index) => index >= 7 && /[.!?][”"']?$/.test(word),
  );
  const passage = projected.metadata
    ? projected.text
    : bounded.slice(0, lastSentence >= 0 ? lastSentence + 1 : undefined).join(" ");
  if (url.hostname.endsWith("bandcamp.com")) {
    const firstLine = text.split("\n")[0]?.trim();
    const slug = url.pathname.split("/").filter(Boolean).at(-1)?.replace(/-/g, " ");
    title =
      firstLine?.includes(" | ") && firstLine.length < 200
        ? firstLine.split(" | ")[0]
        : `Bandcamp · ${slug ?? "artist page"}`;
  }
  return {
    id:
      focus !== ""
        ? `${source.sourceId}::excerpt:${typeof focus === "number" ? focus : offset}`
        : source.sourceId,
    title: url.hostname.endsWith("instagram.com") ? "Instagram" : title,
    url: source.url,
    text: passage,
    ...(source.image ? { image: source.image } : {}),
    ...(url.hostname.endsWith("instagram.com") ? { mediaKind: "instagram" as const } : {}),
    category: source.pdf ? "document" : "source",
    ...(source.pdf ? { page: source.pdf.page } : {}),
    date: source.activityDate ?? source.publishedAt,
    dateKind: source.activityDate
      ? source.activityDateKind === "release"
        ? "Release date from stored provider record"
        : "Activity date from stored provider record"
      : source.publishedAt
        ? "Post/source published"
        : "Publication date unavailable",
    attribution,
    limitation: [
      !passage
        ? "No readable passage is available in this stored extraction. Open the original source for context."
        : projected.metadata
          ? "Labeled fields from stored provider metadata, not an artist quotation. Missing artist names are not inferred from account IDs. Provider release dates do not establish recording dates."
          : "Exact excerpt from stored public source text, limited to 25 words. Post/upload dates do not establish when the music was created. Open the source for full context.",
      source.pdf?.limitation ?? "",
      source.evidenceKind === "provider_transcript"
        ? "Speaker attribution is unverified; this is a provider transcript, not an artist-authored caption."
        : "",
      source.curation === "pending" ? "This stored source is pending review." : "",
      source.truncated ? "The stored extraction is truncated." : "",
      source.sourceId.startsWith("public_answer:")
        ? "Question premises are not artist statements; distinguish the labeled question from the response."
        : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
