import { createHash } from "node:crypto";
export const pdfTextHash = (text: Uint8Array | string) =>
  createHash("sha256").update(text).digest("hex");
