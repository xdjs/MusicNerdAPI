import type { ResearchStage } from "@/lib/questionResearch/types";
/** Safe progress copy names real stages without exposing queries or claiming an answer. */
export function researchStatusMessage(stage: ResearchStage, provider: string | null): string {
  const labels: Record<string, string> = {
    web: "public reporting and original release pages",
    page: "the original page",
    instagram: "the artist's Instagram posts",
    instagram_reels: "the selected Instagram reel",
    tiktok: "the artist's TikTok posts",
    x: "the artist's X posts",
  };
  switch (stage) {
    case "checking_saved":
      return "Checking saved public originals…";
    case "searching":
      return "I haven't found enough in saved sources. I'm searching for an original public source.";
    case "reading":
      return `I haven't found enough in saved sources. I'm checking ${labels[provider ?? ""] ?? "the original source"}.`;
    case "transcribing":
      return "I need the spoken context. I'm requesting the selected Instagram reel's transcript.";
    case "waiting_provider":
      return `Research is still running for ${labels[provider ?? ""] ?? "the selected source"}.`;
    case "complete":
      return "Original evidence is ready to read. Check its scope and qualifications before answering.";
    case "unresolved":
      return "I couldn't establish this from the supported sources. The evidence gap remains explicit.";
    case "failed":
      return "Research couldn't finish. This does not mean the information doesn't exist.";
    case "cancelled":
      return "Research stopped because artist access or the connected source changed.";
  }
}
