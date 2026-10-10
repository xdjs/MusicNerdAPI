import type { LatestProvider } from "./types";
/** Normalize only connected provider identities; never match by artist name. */
export function latestProviderAccount(provider: LatestProvider, value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (provider === "spotify") return /^[a-zA-Z0-9]{22}$/.test(id) ? id : null;
  if (provider === "deezer") return /^[1-9]\d*$/.test(id) ? id : null;
  const match =
    /^(?:https?:\/\/(?:www\.)?inprocess\.world\/)?(0x[a-fA-F0-9]{40})\/?(?:[?#].*)?$/.exec(id);
  return match ? match[1].toLowerCase() : null;
}
