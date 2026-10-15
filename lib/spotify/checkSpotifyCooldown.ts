import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import { spotifyCooldownKey } from "./spotifyCooldownKey";
import { SpotifyDeferredError } from "./SpotifyDeferredError";

/** Fail closed if the shared store is unavailable; a warm process cache cannot coordinate deployments. */
export async function checkSpotifyCooldown(): Promise<void> {
  const key = spotifyCooldownKey();
  if (!key) return; // Credential validation remains at getSpotifyHeaders.
  const [row] = rowsOf(
    await db.execute(sql`
    select extract(epoch from blocked_until)*1000 as "retryAtMs"
    from provider_request_cooldowns where provider_key=${key} and blocked_until>now()
  `),
  ) as { retryAtMs: string | number }[];
  if (row) throw new SpotifyDeferredError(Number(row.retryAtMs));
}
