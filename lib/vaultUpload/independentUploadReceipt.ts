import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { rowsOf } from "@/lib/db/rowsOf";
import { artistActivityEvents, artistVaultSources } from "@/lib/db/schema";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import type { IndependentUploadContent, IndependentUploadTicket } from "./independentUploadTypes";

/** Atomic independent submission/receipt. The original event survives source deletion as a tombstone. */
export async function independentUploadReceipt(
  ticket: IndependentUploadTicket,
  content?: IndependentUploadContent,
) {
  return db.transaction(async tx => {
    await lockArtistRow(tx, ticket.artistId);
    const event = await tx.query.artistActivityEvents.findFirst({
      where: and(
        eq(artistActivityEvents.sourceId, ticket.sourceId),
        eq(artistActivityEvents.action, "source_upload"),
      ),
    });
    const source = await tx.query.artistVaultSources.findFirst({
      where: eq(artistVaultSources.id, ticket.sourceId),
    });
    if (event) {
      if (
        event.artistId !== ticket.artistId ||
        event.actorUserId !== ticket.userId ||
        event.actorKind !== "user" ||
        event.action !== "source_upload" ||
        event.trigger !== "trusted_submission"
      )
        throw new OwnershipChangedError();
      if (!source) throw new Error("CONTRIBUTION_REMOVED");
      if (
        source.artistId !== ticket.artistId ||
        source.filePath !== ticket.path ||
        source.activityId !== event.id ||
        source.origin !== "upload"
      )
        throw new OwnershipChangedError();
      // Receipt only: losing trust does not erase provenance or grant private-body access.
      return { id: source.id };
    }
    if (source) throw new OwnershipChangedError();
    const [user] = rowsOf(
      await tx.execute(
        sql`select is_admin,is_white_listed from users where id=${ticket.userId}::uuid for share`,
      ),
    ) as { is_admin: boolean; is_white_listed: boolean }[];
    if (!user || !(user.is_admin || user.is_white_listed)) throw new OwnershipChangedError();
    if (!content) return undefined;
    const [addedEvent] = await tx
      .insert(artistActivityEvents)
      .values({
        artistId: ticket.artistId,
        actorUserId: ticket.userId,
        actorKind: "user",
        action: "source_upload",
        trigger: "trusted_submission",
        sourceId: ticket.sourceId,
      })
      .returning();
    if (!addedEvent) throw new Error("Contribution receipt unavailable");
    // No inherited artist-operation activity, publication upgrade, or existing-source mutation.
    await tx.insert(artistVaultSources).values({
      id: ticket.sourceId,
      artistId: ticket.artistId,
      activityId: addedEvent.id,
      origin: "upload",
      status: "approved",
      publication: "inherit",
      url: content.url,
      title: ticket.name,
      snippet: content.extractedText?.slice(0, 300) ?? `Uploaded file: ${ticket.name}`,
      extractedText: content.extractedText,
      type: content.sourceType,
      fileName: ticket.name,
      fileSize: ticket.size,
      filePath: ticket.path,
      contentType: ticket.type,
    });
    return { id: ticket.sourceId };
  });
}
