/** Deezer's public API; it needs no key. */
export const DEEZER_API = "https://api.deezer.com";
/** Per-request ceiling for Deezer calls. */
export const DEEZER_TIMEOUT_MS = 5_000;
/** Deezer's top tracks carry no ISRCs, so each costs a second call. Five out-votes
 *  a featured collaborator and stays inside a discovery tier's budget. */
export const ISRC_MAX_TRACKS = 5;
/** Per-request ceiling for the ISRC lookups: a hang must not eat the onboarding turn. */
export const ISRC_FETCH_TIMEOUT_MS = 4_000;
