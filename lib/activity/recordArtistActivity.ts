import { db } from "@/lib/db/db";
import { artistActivityEvents } from "@/lib/db/schema";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";

/**
 * Appends a server-attributed request or change to the artist's activity. The
 * user, trigger and parent come from the running operation unless given, and a
 * write with no user is recorded as `unknown`, never as someone.
 *
 * @param artistId - The artist.
 * @param action - What happened, e.g. `source_search` or `source_added`.
 * @param options - Attribution to record instead of the operation's.
 * @param options.userId - The acting user.
 * @param options.trigger - What set it off.
 * @param options.actorKind - Who acted, when there is no user.
 * @param options.sourceId - The source it concerns.
 * @param options.parentActivityId - The activity it belongs to.
 * @param writer - The transaction to write in; the plain client by default.
 * @returns The event's id. Throws when it can't be recorded, so research never runs unrecorded.
 */
export async function recordArtistActivity(
  artistId: string,
  action: string,
  options: {
    userId?: string;
    trigger?: string;
    actorKind?: "user" | "system" | "unknown";
    sourceId?: string;
    parentActivityId?: string;
  } = {},
  writer: Pick<typeof db, "insert"> = db,
): Promise<string> {
  const context = getArtistOperationOwnership(artistId);
  const userId = options.userId ?? context?.userId;
  const [event] = await writer
    .insert(artistActivityEvents)
    .values({
      artistId,
      action,
      actorUserId: userId ?? null,
      actorKind: userId ? "user" : (options.actorKind ?? "unknown"),
      trigger: options.trigger ?? context?.trigger ?? "unrecorded",
      sourceId: options.sourceId ?? null,
      parentActivityId: options.parentActivityId ?? context?.activityId ?? null,
    })
    .returning({ id: artistActivityEvents.id });
  if (!event) throw new Error("Could not record artist activity");
  return event.id;
}
