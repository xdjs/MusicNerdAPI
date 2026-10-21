/**
 * One Supabase Storage call as the service role, over `fetch`, the way the
 * Instagram thumbnails are stored. The path is relative to `/storage/v1/`.
 * Redirects are refused so storage cannot send the service key elsewhere.
 *
 * @param path - The storage path after `/storage/v1/`, such as `object/vault-files/a.png`.
 * @param init - Request options; the auth headers are added.
 * @returns The response, whatever its status.
 */
export async function storageRequest(path: string, init: RequestInit): Promise<Response> {
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return fetch(`${supabaseUrl}/storage/v1/${path}`, {
    ...init,
    redirect: "error",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}
