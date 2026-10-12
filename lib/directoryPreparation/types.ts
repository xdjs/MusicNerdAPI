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
};
export type DirectoryDraft = {
  status: "ready" | "insufficient";
  document: string | null;
  about: string | null;
};
