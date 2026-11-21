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
/** Adding an artist waits on the counterpart lookup, so its MusicBrainz calls share this budget. */
export const COUNTERPART_BUDGET_MS = 6_000;
/** Each counterpart request is clipped to this, and to what is left of the budget. */
export const COUNTERPART_REQUEST_TIMEOUT_MS = 2_500;
