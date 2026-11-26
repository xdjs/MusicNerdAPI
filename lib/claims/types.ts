/** A claim as the claim routes read it. */
export type ClaimRow = {
  id: string;
  userId: string;
  artistId: string;
  status: "pending" | "approved" | "rejected";
  referenceCode: string | null;
};
