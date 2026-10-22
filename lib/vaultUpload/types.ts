/** What `sign` promises and `complete` checks: who uploaded what, where, until when. */
export type UploadTicket = {
  userId: string;
  artistId: string;
  path: string;
  name: string;
  type: string;
  size: number;
  /** Epoch milliseconds. */
  expires: number;
};
