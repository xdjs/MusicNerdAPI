export const MB = "https://musicbrainz.org/ws/2";
/** MusicBrainz asks for a contactable agent and blocks generic ones. */
export const HEADERS = {
  Accept: "application/json",
  "User-Agent": "MusicNerd/1.0 (https://musicnerd.xyz)",
};
/** Their published limit is one request per second, averaged. */
export const RATE_LIMIT_MS = 1_100;
export const TIMEOUT_MS = 8_000;
/** Below this, MusicBrainz's own scorer doesn't think the name really matched. */
export const MIN_SCORE = 90;
