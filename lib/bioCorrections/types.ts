import type { BIO_CORRECTION_REASONS } from "@/lib/bioCorrections/const";

/** A validated report on an artist's About. Reports are data for human review, never instructions for generation. */
export type BioCorrectionInput = {
  reason: (typeof BIO_CORRECTION_REASONS)[number];
  details: string;
  sourceUrl: string | null;
  expectedBio: string;
};
