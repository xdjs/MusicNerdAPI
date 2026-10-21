/**
 * A call to Supabase Storage's REST API as the service role, the way
 * `lib/instagram` already talks to it: no client library, no redirects.
 *
 * @param path - The path under `/storage/v1/`, such as `object/list/<bucket>`.
 * @param init - The request; its headers are merged with the service-role headers.
 * @returns The Storage response; throws when `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is unset.
 */
export async function storageFetch(path: string, init: RequestInit): Promise<Response> {
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase Storage is not configured");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${serviceKey}`);
  headers.set("apikey", serviceKey);
  return fetch(`${supabaseUrl}/storage/v1/${path}`, { ...init, headers, redirect: "error" });
}
