export type RecordingMatch = {
  isrc: string;
  artists: { id: string; name: string }[];
  incomplete?: boolean;
};
export type SpotifyMatchState = {
  version: 1;
  purpose: "spotify_identity";
  deezerId: string;
  artistName: string;
  creationActivityId: string;
  directoryActivityId: string;
  expiresAtMs: number;
  nextAttemptAtMs?: number;
  phase?: "top" | "deezer" | "spotify";
  trackIds?: string[];
  trackCursor?: number;
  isrcs?: string[];
  matches?: RecordingMatch[];
  identityChanged?: boolean;
  outcome?: string;
};
