/** The providers an artist can take their profile photo from, in the order the choices list them. */
export const PHOTO_SOURCES = ["deezer", "spotify"] as const;

/** The largest profile image accepted. */
export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

/** The image types a profile image may declare; each has a magic-byte check. */
export const PROFILE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** The stored file's extension per declared type. */
export const PROFILE_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

/** The folder in the vault bucket that holds uploaded profile images. */
export const PROFILE_IMAGE_FOLDER = "profile-images";

/**
 * Stale profile-image purge: don't delete anything younger than this. The
 * exact-filename guard is the primary safety net; it makes the new upload
 * unkillable regardless of clock skew. This window catches OTHER same-artist
 * concurrent uploads (two browser tabs racing), where the second upload's
 * list would otherwise find the first upload's object and remove it before
 * the first one's database update lands.
 */
export const STALE_PROFILE_IMAGE_GRACE_MS = 30_000;
