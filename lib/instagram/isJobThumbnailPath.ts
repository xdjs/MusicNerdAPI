/**
 * Whether a storage path is one this code generated for a job's thumbnail:
 * under the job's prefix, then `<postId>-<sha256>.webp` and nothing else.
 *
 * @param path - A storage path.
 * @param prefix - The job's prefix, `<artistId>/instagram-<jobId>-`.
 * @returns True only for the job's own generated paths.
 */
export function isJobThumbnailPath(path: string, prefix: string): boolean {
  return path.startsWith(prefix) && /^\d+-[a-f0-9]{64}\.webp$/.test(path.slice(prefix.length));
}
