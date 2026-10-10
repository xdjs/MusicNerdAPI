import type { ResearchOriginal } from "@/lib/questionResearch/types";
export type LatestProvider = "spotify" | "deezer" | "inprocess";
export type LatestProviderCard = {
  id: string;
  kind: "release" | "moment";
  title: string;
  text: string;
  date: string;
  imageUrl: string | null;
  imageCaption: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceId: string;
  revision: string;
  momentKind?: "video" | "audio" | "image" | "writing" | "other";
  listeningLinks?: { siteName: string; href: string; label: string; iconSrc: string }[];
};
export type LatestProviderItem = {
  card: LatestProviderCard;
  original: Omit<ResearchOriginal, "retrievedAt">;
};
export type LatestProviderCoverage = {
  provider: LatestProvider;
  status: "checked" | "failed" | "missing" | "disconnected";
  checkedAt: string | null;
  lastAttemptAt: string | null;
  stale: boolean;
};
