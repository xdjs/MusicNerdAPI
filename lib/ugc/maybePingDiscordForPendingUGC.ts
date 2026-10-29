import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { ugcresearch } from "@/lib/db/schema";
import { sendDiscordMessage } from "@/lib/discord/sendDiscordMessage";
import {
  UGC_PING_COOLDOWN_MS,
  UGC_PING_SENTINEL_SITE_NAME,
  UGC_REVIEWER_ROLE_ID,
} from "@/lib/ugc/const";

/**
 * Pings the reviewers on Discord that a link awaits review, at most once per
 * cooldown. The last ping's time lives in one sentinel `ugcresearch` row, as
 * in MusicNerdWeb, so both apps share the cooldown.
 *
 * @returns Once pinged, or at once inside the cooldown.
 */
export async function maybePingDiscordForPendingUGC(): Promise<void> {
  const now = new Date();
  const sentinel = await db.query.ugcresearch.findFirst({
    where: eq(ugcresearch.siteName, UGC_PING_SENTINEL_SITE_NAME),
  });
  const lastSent = sentinel?.createdAt ? new Date(sentinel.createdAt) : null;
  if (lastSent && now.getTime() - lastSent.getTime() <= UGC_PING_COOLDOWN_MS) return;

  await sendDiscordMessage(`<@&${UGC_REVIEWER_ROLE_ID}> New UGC awaiting review!`);
  if (sentinel) {
    await db
      .update(ugcresearch)
      .set({ createdAt: now.toISOString() })
      .where(eq(ugcresearch.id, sentinel.id));
  } else {
    await db.insert(ugcresearch).values({
      siteName: UGC_PING_SENTINEL_SITE_NAME,
      createdAt: now.toISOString(),
      accepted: true,
    });
  }
}
