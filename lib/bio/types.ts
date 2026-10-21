/** Whose write a bio change is: the claim it was started under, and the acting user when a person started it. */
export type BioWriteOwnership = { expectedClaimId: string | null; userId?: string };

/** Only these fields may leave the private directory preparation store. */
export type PublicArtistAbout = {
  bio: string;
  kind: "official" | "researched";
  sources: { id: string; url: string; label: string }[];
};

/** What `generateArtistBio` answers: the About now saved, or why it was kept. */
export type GeneratedBio =
  | { httpStatus: 200; bio: string | null; pinned?: true; message?: string }
  | { httpStatus: 404 | 408 | 409 | 500; error: string; code?: "LORE_REQUIRED" };

/** What `updateArtistBio` answers, in MusicNerdWeb's result shape. */
export type BioUpdateResult = {
  status: "success" | "error";
  message: string;
  data?: string | null;
  statusCode?: number;
  code?: string;
};
