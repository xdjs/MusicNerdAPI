import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import { listInterviewResponses } from "./listInterviewResponses";
import { readInterviewResponse } from "./readInterviewResponse";
import { listInterviewResponseVersions } from "./listInterviewResponseVersions";
import { reviseInterviewResponse } from "./reviseInterviewResponse";
import { validateInterviewResponseRequest } from "./validateInterviewResponseRequest";
import type { ResponseOperation } from "./types";

/** Authenticate private response review and edits; never expose storage errors or cache testimony. */
export async function handleInterviewResponse(
  request: Request,
  artistId: string,
  operation: ResponseOperation,
  answerId?: string,
) {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  try {
    const query = validateInterviewResponseRequest(request, artistId, operation, answerId);
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse)
      throw new KnowledgeError("unauthenticated", 401, "Not signed in");
    let result;
    if (operation === "list") result = await listInterviewResponses(artistId, auth.userId, query);
    else if (operation === "read")
      result = await readInterviewResponse(artistId, auth.userId, answerId!, query);
    else if (operation === "versions")
      result = await listInterviewResponseVersions(artistId, auth.userId, answerId!, query);
    else
      result = await reviseInterviewResponse(
        artistId,
        auth.userId,
        answerId!,
        await readBody(request),
      );
    return NextResponse.json(result, { headers });
  } catch (error) {
    const failure =
      error instanceof KnowledgeError
        ? error
        : error instanceof OwnershipChangedError
          ? new KnowledgeError("ownership_changed", 403, "Artist access changed")
          : new KnowledgeError(
              "storage_unavailable",
              503,
              "Interview responses are temporarily unavailable",
            );
    return NextResponse.json(
      { status: "error", error: failure.message, code: failure.code },
      { status: failure.status, headers },
    );
  }
}

async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new KnowledgeError("invalid_input", 400, "A JSON edit is required");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0,
    text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 20000) {
        await reader.cancel();
        throw new KnowledgeError("body_too_large", 413, "Edit exceeds the supported size");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof KnowledgeError) throw error;
    throw new KnowledgeError("invalid_input", 400, "A valid JSON edit is required");
  } finally {
    reader.releaseLock();
  }
}
