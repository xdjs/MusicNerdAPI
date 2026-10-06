import { NextResponse } from "next/server";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { validateSourceExtractionBody } from "@/lib/sourceExtraction/validateSourceExtractionBody";
import { queueSourceExtraction } from "@/lib/sourceExtraction/queueSourceExtraction";

/** Authenticate and explicitly queue missing approved source bodies, without fetching inline. */
export async function postSourceExtractionHandler(
  request: Request,
  id: string,
): Promise<NextResponse> {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  try {
    const auth = await validateArtistEditRequest(request, id);
    if (auth instanceof NextResponse) {
      auth.headers.set("Cache-Control", "private, no-store");
      return auth;
    }
    const body = await validateSourceExtractionBody(request);
    if (body instanceof NextResponse) return body;
    const claim = await findApprovedClaim(db, auth.artistId);
    const result = await withArtistOperation(
      auth.artistId,
      {
        userId: auth.userId,
        expectedClaimId: claim?.id ?? null,
        trigger: "manual_source_extraction",
      },
      () => queueSourceExtraction(auth.artistId, body.sourceIds),
    );
    return NextResponse.json(result, { status: result.jobId ? 202 : 200, headers });
  } catch (error) {
    const safe =
      error instanceof KnowledgeError
        ? error
        : error instanceof OwnershipChangedError
          ? new KnowledgeError("ownership_changed", 403, "Artist access changed")
          : new KnowledgeError("storage_unavailable", 503, "Source extraction is unavailable");
    return NextResponse.json(
      { status: "error", error: safe.message, code: safe.code },
      { status: safe.status, headers },
    );
  }
}
