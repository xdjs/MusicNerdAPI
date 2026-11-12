import type { UploadTicket } from "./types";
/** Signed append-only Lore authority; never claimant/profile authority. */
export type IndependentUploadTicket = UploadTicket & {
  scope: "contribution";
  sourceId: string;
  expectedClaimId: null;
};
export type IndependentUploadContent = {
  url: string;
  extractedText: string | null;
  sourceType: string;
};
