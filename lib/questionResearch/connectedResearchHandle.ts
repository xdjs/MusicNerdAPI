import { socialProfileHandle } from "@/lib/social/socialProfileHandle";
/** Normalize only a stored account on its expected platform; never infer an account from a name. */
export function connectedResearchHandle(
  value: unknown,
  platform: "instagram" | "tiktok" | "x",
): string | null {
  if (typeof value !== "string") return null;
  if (platform !== "instagram") return socialProfileHandle(value, platform);
  let handle = value.trim();
  if (handle.includes("://")) {
    try {
      const u = new URL(handle);
      if (
        u.protocol !== "https:" ||
        !["instagram.com", "www.instagram.com"].includes(u.hostname) ||
        u.port ||
        u.username ||
        u.password ||
        u.search ||
        !/^\/[\w.]+\/?$/.test(u.pathname)
      )
        return null;
      handle = u.pathname.replace(/^\/|\/$/g, "");
    } catch {
      return null;
    }
  }
  handle = handle.replace(/^@/, "").toLowerCase();
  return /^[a-z0-9_.]{1,30}$/.test(handle) &&
    !["reel", "reels", "p", "explore", "accounts", "direct"].includes(handle)
    ? handle
    : null;
}
