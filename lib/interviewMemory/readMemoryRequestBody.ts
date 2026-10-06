import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
/** Bound authenticated request bytes before parsing exact artist instructions. */
export async function readMemoryRequestBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new KnowledgeError("invalid_input", 400, "JSON body required");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 20000)
        throw new KnowledgeError("invalid_input", 400, "Boundary request too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new KnowledgeError("invalid_input", 400, "Invalid JSON body");
  }
}
