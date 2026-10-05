import type { MusicDestination } from "./types";

/** Extract the uploader/store for comparison to a known account, never as proof of artist ownership. */
export function getReleaseOwnerHandle(
  destination: MusicDestination,
): { siteName: string; id: string } | null {
  if (
    destination.kind !== "release" ||
    !["bandcamp", "subvert", "soundcloud", "audius", "mixcloud"].includes(destination.platform)
  )
    return null;
  return { siteName: destination.platform, id: destination.id.split("/")[0] };
}
