import { getSourceTitle } from "@/lib/chat/getSourceTitle";
import { getQuerySnippet } from "@/lib/chat/getQuerySnippet";
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
  let text = source.text;
  let title = getSourceTitle(source.url);
  let attribution = "Stored public source";
  if (url.hostname.endsWith("inprocess.world")) {
    try {
      const metadata: unknown = JSON.parse(source.text);
      if (metadata && typeof metadata === "object") {
        const value = metadata as Record<string, unknown>;
        if (typeof value.description === "string") text = value.description;
        if (typeof value.title === "string") title = value.title.slice(0, 200);
      }
    } catch {
      /* Older stored source is plain text. */
    }
    attribution = "InProcess · work description";
  } else if (url.hostname.endsWith("instagram.com"))
    attribution =
      source.evidenceKind === "provider_transcript"
        ? "Instagram · stored provider transcript"
        : "Instagram · stored caption";
  else if (source.sourceId.startsWith("public_answer:"))
    attribution = "Published interview · question and response";
  if (source.pdf) {
    title = source.pdf.title;
    attribution = "Published Lore PDF · extracted page";
  }
  const snippet =
    typeof focus === "number"
      ? text.slice(Math.max(0, focus), Math.max(0, focus) + 400).trim()
      : getQuerySnippet(text, focus || title, 400);
  const offset = Math.max(0, text.indexOf(snippet));
  const passage = snippet.trim().split(/\s+/).slice(0, 25).join(" ");
  return {
    id: focus !== "" ? `${source.sourceId}::excerpt:${offset}` : source.sourceId,
    title,
    url: source.url,
    text: passage,
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
      "Exact excerpt from stored public source text, limited to 25 words. Post/upload dates do not establish when the music was created. Open the source for full context.",
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
