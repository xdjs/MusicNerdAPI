/** Whose write a bio change is: the claim it was started under, and the acting user when a person started it. */
export type BioWriteOwnership = { expectedClaimId: string | null; userId?: string };

/** An unclaimed artist's published directory About and the sources it cites. */
export type PublicArtistAbout = {
  bio: string;
  kind: "official" | "researched";
  sources: { id: string; url: string; label: string }[];
};
