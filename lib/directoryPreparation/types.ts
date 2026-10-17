/** Exact stored original assessed for identity; pending is deliberately not approval. */
export type PreparedSource = {
  [key: string]: unknown;
  id: string;
  artistId: string;
  url: string;
  title: string | null;
  extractedText: string;
  publishedAt: string | null;
  status: string;
};
export type DirectoryMaterial = {
  artistName: string;
  startingBio: string | null;
  manifest: PreparedSource[];
  accounts?: Record<string, string>;
};
export type DirectoryDraft = {
  status: "ready" | "insufficient";
  document: string | null;
  about: string | null;
};
export type PublicAbout = {
  version: 1;
  identity: { name: string; accounts: Record<string, string> };
  bio: string;
  kind: "official" | "researched";
  sources: { id: string; url: string; label: string }[];
  ownership?: { siteName: string; id: string };
};
