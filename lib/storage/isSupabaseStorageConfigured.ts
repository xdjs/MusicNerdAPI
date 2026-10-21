/**
 * Whether Supabase Storage is usable here: both the project URL and the
 * service-role key are set. The common deploy mistake sets only
 * `SUPABASE_DB_CONNECTION`, which makes every upload a generic 500; routes
 * call this to answer with a clear "storage not configured" instead.
 *
 * @returns True when the storage credentials are present.
 */
export function isSupabaseStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
