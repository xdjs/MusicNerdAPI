import type { z } from "zod";
import type { sourceExtractionSchemas } from "@/lib/sourceExtraction/sourceExtractionSchemas";
export type ExtractionOutcome = z.infer<typeof sourceExtractionSchemas.outcome>;
export type ExtractionState = z.infer<typeof sourceExtractionSchemas.state>;
export type FetchedSource = Omit<ExtractionOutcome, "sourceId" | "storedChars"> & {
  text?: string;
  resolvedUrl?: string;
  /** Explicit page publication metadata; never the capture or event date. */
  publishedAt?: string | null;
};
