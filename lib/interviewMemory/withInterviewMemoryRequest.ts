import { z } from "zod";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
/** Private authentication/error boundary; mutations and reads reauthorize inside their transactions. */
export async function withInterviewMemoryRequest(
  request: Request,
  artistId: string,
  operation: (userId: string) => Promise<unknown>,
) {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  try {
    if (!z.uuid().safeParse(artistId).success)
      throw new KnowledgeError("invalid_input", 400, "Invalid artist ID");
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse)
      throw new KnowledgeError("unauthenticated", 401, "Not signed in");
    return NextResponse.json(await operation(auth.userId), { headers });
  } catch (error) {
    const failure =
      error instanceof KnowledgeError
        ? error
        : new KnowledgeError(
            "memory_unavailable",
            503,
            "Interview memory is temporarily unavailable",
          );
    return NextResponse.json(
      { status: "error", error: failure.message, code: failure.code },
      { status: failure.status, headers },
    );
  }
}
