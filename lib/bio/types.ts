/** Whose write a bio change is: the claim it was started under, and the acting user when a person started it. */
export type BioWriteOwnership = { expectedClaimId: string | null; userId?: string };
