import type { MusicPlatform } from "@/lib/musicPlatform/types";

/** An artist already in the directory, offered instead of adding another. */
export type AddArtistCandidate = {
  imageUrl?: string;
  id: string;
  name: string | null;
  spotify: string | null;
  deezer: string | null;
};

/** One platform identity: a platform and the artist's id on it. */
export type ArtistPlatformIdentity = { platform: MusicPlatform; platformId: string };

/** Who holds a platform id: nobody, one artist, or conflicting records. */
export type PlatformIdOwnerResolution =
  | { status: "none" }
  | { status: "owner"; owner: AddArtistCandidate }
  | { status: "conflict"; candidates: AddArtistCandidate[] };

/** The 200 body of POST /api/artist, without its `status`. */
export type AddArtistBody =
  | { result: "created" | "exists"; artistId: string; artistName: string; message: string }
  | {
      result: "possible_duplicate";
      candidates: AddArtistCandidate[];
      platform: MusicPlatform;
      platformId: string;
      artistName?: string;
      canCreateSeparate?: boolean;
      message: string;
    }
  | {
      result: "conflict";
      candidates: AddArtistCandidate[];
      platform: MusicPlatform;
      platformId: string;
      message: string;
    };

/** What adding an artist did; `created` carries what the follow-ups need. */
export type AddArtistOutcome = {
  body: AddArtistBody;
  created?: { createdAt: string | null; platformId: string };
};

/** A refused add, with the HTTP status to answer. */
export type RefusedAddArtist = { status: 404 | 409; error: string };
