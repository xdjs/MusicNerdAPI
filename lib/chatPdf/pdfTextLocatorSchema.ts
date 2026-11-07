import { z } from "zod";
import { MAX_CHAT_PDF_PAGES } from "./types";
const sha = z.string().regex(/^[a-f0-9]{64}$/);
export const pdfTextLocatorSchema = z
  .object({
    sourceId: z.uuid(),
    revision: z.string().min(1).max(300),
    originalSha256: sha,
    physicalPage: z.number().int().min(1).max(MAX_CHAT_PDF_PAGES),
    pageSha256: sha,
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    sha256: sha,
  })
  .strict();
