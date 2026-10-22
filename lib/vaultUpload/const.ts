export const MAX_VAULT_FILE_BYTES = 10 * 1024 * 1024;
export const VAULT_UPLOAD_LIMIT_LABEL = "10 MB per file";
export const VAULT_UPLOAD_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
  "audio/mpeg",
  "audio/wav",
];
/** The stored extension for each allowed type, for the direct upload's storage key. */
export const MIME_EXT_MAP: Record<string, string> = {
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "text/csv": ".csv",
  "application/json": ".json",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
};
/** A signed upload must be completed within this long. */
export const UPLOAD_TICKET_TTL_MS = 15 * 60_000;
export const PDF_PARSE_TIMEOUT_MS = 10_000;
