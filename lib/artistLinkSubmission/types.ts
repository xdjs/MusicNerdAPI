/** A link that was saved, approved or pending. */
export type SubmittedArtistLink = {
  approved: boolean;
  siteName: string;
  platformName: string | null;
  message: string;
};

/** A link that was refused, with the HTTP status to answer. */
export type RefusedArtistLink = { status: 400 | 409; error: string };
