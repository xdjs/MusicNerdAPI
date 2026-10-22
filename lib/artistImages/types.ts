import type { artists } from "@/lib/db/schema";
import type { PHOTO_SOURCES } from "@/lib/artistImages/const";

/** A provider an artist's photo can come from. */
export type PhotoSource = (typeof PHOTO_SOURCES)[number];

/** The artist columns the photo choices read. */
export type PhotoChoiceArtist = Pick<typeof artists.$inferSelect, "deezer" | "spotify">;

/** One stored object, as Supabase Storage's list call returns it. */
export type StorageObject = { name: string; created_at?: unknown };
