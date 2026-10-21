/**
 * The public URL of an object in a public bucket. A string, no request.
 *
 * @param bucket - The bucket.
 * @param path - The object's key.
 * @returns The URL browsers can load the object from.
 */
export function getPublicUrl(bucket: string, path: string): string {
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}
