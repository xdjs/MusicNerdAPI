/**
 * One authenticated call to Supabase Storage's REST API with the service-role
 * key, the way `@supabase/supabase-js` would make it, over plain `fetch`.
 * Throws a fixed diagnostic (`HTTP <status>`) that never carries the URL or
 * the key.
 *
 * @param path - The path under `/storage/v1`, e.g. `object/vault-files/a/b.pdf`.
 * @param init - The request: method, headers, body.
 * @returns The OK response; throws when the credentials are unset or storage refuses.
 */
export async function storageRequest(path: string, init: RequestInit): Promise<Response> {
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceKey)
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  const response = await fetch(`${supabaseUrl}/storage/v1/${path}`, {
    ...init,
    redirect: "error",
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, ...init.headers },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`HTTP ${response.status}`);
  }
  return response;
}
