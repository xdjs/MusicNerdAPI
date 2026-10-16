import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import { spotifyCooldownKey } from "./spotifyCooldownKey";
import { parseSpotifyRetryAfter } from "./parseSpotifyRetryAfter";

/** Extend atomically: a shorter concurrent 429 must not reopen an application still blocked. */
export async function recordSpotifyCooldown(value: string | null): Promise<number> {
  const retryAtMs = parseSpotifyRetryAfter(value);
  const key = spotifyCooldownKey();
  if (!key) return retryAtMs;
  const [row] = rowsOf(
    await db.execute(sql`
    insert into provider_request_cooldowns(provider_key,blocked_until,updated_at)
    values(${key},${new Date(retryAtMs).toISOString()}::timestamptz,now())
    on conflict(provider_key) do update set
      blocked_until=greatest(provider_request_cooldowns.blocked_until,excluded.blocked_until),updated_at=now()
    returning extract(epoch from blocked_until)*1000 as "retryAtMs"
  `),
  ) as { retryAtMs: string | number }[];
  if (!row) throw new Error("Could not persist Spotify cooldown");
  return Number(row.retryAtMs);
}
