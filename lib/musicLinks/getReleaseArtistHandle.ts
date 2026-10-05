import type { MusicDestination } from "./types";

/** Keep an explicit artist scope as identity evidence, never infer it from an opaque release ID. */
export function getReleaseArtistHandle(
  destination: MusicDestination,
): { siteName: string; id: string } | null {
  if (
    destination.kind !== "release" ||
    !["bandcamp", "subvert", "soundcloud", "audius", "mixcloud"].includes(destination.platform)
  )
    return null;
  return { siteName: destination.platform, id: destination.id.split("/")[0] };
}
