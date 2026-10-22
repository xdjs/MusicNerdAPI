/**
 * A byte count for an error message or a placeholder snippet.
 *
 * @param bytes - The size.
 * @returns `512 B`, `1.5 KB` or `10.0 MB`.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
