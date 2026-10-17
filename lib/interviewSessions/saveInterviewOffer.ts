import { db } from "@/lib/db/db";
import { saveInterviewOfferInTransaction } from "./saveInterviewOfferInTransaction";
/** Atomically save one exact offer under the existing actor and snapshot checks. */
export async function saveInterviewOffer(
  artistId: string,
  userId: string,
  sessionId: string,
  body: unknown,
) {
  return db.transaction(tx =>
    saveInterviewOfferInTransaction(tx, artistId, userId, sessionId, body),
  );
}
