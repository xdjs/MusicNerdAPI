/**
 * Whether Supabase Storage is usable in this environment. False when the
 * service-role credentials are absent: the common deploy misconfiguration
 * where `SUPABASE_DB_CONNECTION` is set but the storage vars are not, so every
 * upload would fail as a generic 500. The upload route checks this to fail
 * fast with a clear "storage not configured" message instead.
 *
 * @returns True when both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set.
 */
export function isSupabaseStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
