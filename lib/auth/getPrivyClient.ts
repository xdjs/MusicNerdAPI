import { PrivyClient } from "@privy-io/server-auth";

let client: PrivyClient | null = null;

/**
 * The Privy server client, built on first use so importing this never needs
 * the env. Same app as MusicNerdWeb, so its access tokens verify here.
 *
 * @returns The shared client; throws when `PRIVY_APP_ID` or `PRIVY_APP_SECRET` is unset.
 */
export function getPrivyClient(): PrivyClient {
  if (client) return client;
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) throw new Error("Privy is not configured");
  client = new PrivyClient(appId, appSecret);
  return client;
}
