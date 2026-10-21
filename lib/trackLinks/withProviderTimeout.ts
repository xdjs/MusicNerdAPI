import { PROVIDER_TIMEOUT_MS } from "@/lib/trackLinks/const";

/**
 * A provider call bounded by `PROVIDER_TIMEOUT_MS`; a timeout or a failure
 * resolves to null rather than throwing, as MusicNerdWeb's did.
 *
 * @param p - The provider request.
 * @returns Its result, or null.
 */
export async function withProviderTimeout<T>(p: Promise<T>): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>(resolve => setTimeout(() => resolve(null), PROVIDER_TIMEOUT_MS)),
  ]).catch(() => null);
}
