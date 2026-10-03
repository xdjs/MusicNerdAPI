import type { ProfilePlatform } from "@/lib/social/types";

/** Normalizes a stored profile handle, refusing unrelated URLs and X reserved routes. */
export function socialProfileHandle(
  value: string | null | undefined,
  platform: ProfilePlatform,
): string | null {
  if (!value?.trim()) return null;
  let handle = value.trim();
  if (handle.includes("://")) {
    try {
      const url = new URL(handle);
      const hosts = platform === "x" ? ["x.com", "twitter.com"] : ["tiktok.com"];
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        !hosts.includes(url.hostname.replace(/^www\./, ""))
      )
        return null;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length !== 1 || url.search) return null;
      handle = parts[0];
    } catch {
      return null;
    }
  }
  handle = handle.replace(/^@/, "").toLowerCase();
  const valid = platform === "x" ? /^[a-z0-9_]{1,15}$/ : /^[a-z0-9_.]{1,24}$/;
  if (!valid.test(handle)) return null;
  if (
    platform === "x" &&
    [
      "home",
      "search",
      "explore",
      "settings",
      "messages",
      "notifications",
      "i",
      "intent",
      "share",
    ].includes(handle)
  )
    return null;
  return handle;
}
