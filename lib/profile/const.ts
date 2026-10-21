/** Artists per page of GET /api/profile/artists. */
export const PROFILE_ARTISTS_PAGE_SIZE = 24;
/** Artists read per page of GET /api/profile/updates; bounds the Latest fan-out. */
export const PROFILE_UPDATES_BATCH = 6;
/**
 * Which Latest card kinds each `kind` filter keeps. The older filter names
 * (`Instagram`, `Interview`, `In-Process`) stay for pages open before the
 * profile groupings changed.
 */
export const PROFILE_UPDATE_KINDS: Record<string, readonly string[]> = {
  All: ["release", "instagram", "moment", "interview"],
  Release: ["release"],
  Socials: ["instagram", "moment"],
  Lore: ["interview"],
  Instagram: ["instagram"],
  Interview: ["interview"],
  "In-Process": ["moment"],
};
