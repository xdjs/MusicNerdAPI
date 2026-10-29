import { getSourceTitle } from "@/lib/chat/getSourceTitle";
import { getQuerySnippet } from "@/lib/chat/getQuerySnippet";
import type { ResearchOriginal } from "@/lib/questionResearch/types";
import type { CanvasEvidence } from "./const";
/** Adapt stored source metadata into a readable, bounded excerpt without inventing facts. */
export function buildCanvasEvidence(source: ResearchOriginal, focus = ""): CanvasEvidence | null {
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
  } else if (url.hostname.endsWith("instagram.com")) attribution = "Instagram · stored caption";
  const passage = getQuerySnippet(text, focus || title, 400)
    .trim()
    .split(/\s+/)
    .slice(0, 25)
    .join(" ");
  return {
    id: source.sourceId,
    title,
    url: source.url,
    text: passage,
    category: "source",
    date: source.publishedAt,
    dateKind: source.publishedAt ? "Post/source published" : "Publication date unavailable",
    attribution,
    limitation:
      "Exact excerpt from stored public source text, limited to 25 words. Post/upload dates do not establish when the music was created. Open the source for full context.",
  };
}
