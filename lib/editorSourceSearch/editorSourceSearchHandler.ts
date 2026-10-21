import { NextResponse } from "next/server";
import { validateEditorSourceSearchInput } from "./validateEditorSourceSearchInput";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { requestEditorSourceSearch } from "./requestEditorSourceSearch";
import { getEditorSourceSearch } from "./getEditorSourceSearch";

/** Authenticated request/status boundary; transport failures instruct clients to retain their key. */
export async function editorSourceSearchHandler(
  request: Request,
  id: string,
): Promise<NextResponse> {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  try {
    const auth = await validateArtistEditRequest(request, id);
    if (auth instanceof NextResponse) return auth;
    const input = await validateEditorSourceSearchInput(request);
    if (input instanceof NextResponse) return input;
    const result = await (
      request.method === "POST" ? requestEditorSourceSearch : getEditorSourceSearch
    )(auth.artistId, auth.userId, input.requestId);
    return NextResponse.json(result, { headers });
  } catch (error) {
    if (error instanceof KnowledgeError)
      return NextResponse.json(
        { status: "error", error: error.message },
        {
          status: error.status,
          headers: { ...headers, ...(error.status === 429 ? { "Retry-After": "1800" } : {}) },
        },
      );
    return NextResponse.json(
      { status: "error", error: "Search status unavailable; retry with the same requestId" },
      { status: 503, headers },
    );
  }
}
