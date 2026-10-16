import { createHash } from "node:crypto";

/** Same public client-ID digest as Web; token and secret rotation never reset the quota. */
export function spotifyCooldownKey(): string | null {
  const id = process.env.SPOTIFY_WEB_CLIENT_ID;
  return id ? `spotify:${createHash("sha256").update(id).digest("hex")}` : null;
}
