/** What `sign` promises and `complete` checks: who uploaded what, where, until when. */
export type UploadTicket = {
  userId: string;
  /** Approved claim at signing; null is an explicit unclaimed generation. */
  expectedClaimId: string | null;
  artistId: string;
  path: string;
  name: string;
  type: string;
  size: number;
  /** Epoch milliseconds. */
  expires: number;
};
