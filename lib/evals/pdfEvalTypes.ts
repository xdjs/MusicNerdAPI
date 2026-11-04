import { z } from "zod";

export const pdfEvalDocumentSchema = z
  .object({
    sourceId: z.uuid(),
    revision: z.string().min(1).max(500),
    filename: z.string().min(1).max(300),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z
      .number()
      .int()
      .min(1)
      .max(4 * 1024 * 1024),
    pages: z.number().int().min(1).max(50),
  })
  .strict();
export type PdfEvalDocument = z.infer<typeof pdfEvalDocumentSchema>;
/** Explicit opt-in, separate from the unchanged text-only article manifest. No live defaults. */
export const pdfEvalSchema = z
  .object({
    documents: z.array(pdfEvalDocumentSchema).min(1).max(8),
    maxUniqueDocuments: z.number().int().min(1).max(2),
    maxBytesPerCall: z
      .number()
      .int()
      .min(1)
      .max(8 * 1024 * 1024),
    maxTotalBytes: z
      .number()
      .int()
      .min(1)
      .max(48 * 1024 * 1024),
    maxPagesPerCall: z.number().int().min(1).max(100),
    maxTotalPages: z.number().int().min(1).max(600),
  })
  .strict()
  .refine(
    p => new Set(p.documents.map(d => d.sourceId)).size === p.documents.length,
    "Duplicate PDF source",
  );
