import { draftLatestRefresh } from "@/lib/latest/draftLatestRefresh";
import { saveLatestRefresh } from "@/lib/latest/saveLatestRefresh";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";

/**
 * Queue all connected sources for the research worker; no provider fetches in
 * this request. Runs inside `withArtistOperation`, which names the requester.
 *
 * @param artistId - The artist.
 * @returns The `latest_refresh` job id: the live or cooling-down one, or the one queued now.
 */
export async function requestLatestRefresh(artistId: string): Promise<string> {
  const context = getArtistOperationOwnership(artistId);
  if (!context?.userId) throw new Error("Missing Latest requester");
  // A connection changed during the checks means they checked the wrong
  // identities: check the current ones once more rather than queue a job that
  // is out of scope the moment it is saved.
  for (let attempt = 0; attempt < 2; attempt++) {
    const draft = await draftLatestRefresh(artistId, context);
    if (typeof draft === "string") return draft;
    const state = draft;
    const id = await saveLatestRefresh(artistId, state);
    if (id) return id;
  }
  throw new Error("Connections changed while Latest was checking");
}
