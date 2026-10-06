import { knowledgeRevision } from "@/lib/knowledge/knowledgeRevision";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";

/** Artist/filter/revision-bound continuation, never a substitute for authorization. */
export function knowledgeCursor(context: unknown, cursor?: string) {
  const fingerprint = knowledgeRevision(context);
  let position = [0, 0, 0];
  if (cursor) {
    let parsed: unknown;
    try {
      if (cursor.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
      parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    } catch {
      throw new KnowledgeError("invalid_input", 400, "Invalid knowledge cursor");
    }
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 3 ||
      parsed[0] !== 1 ||
      typeof parsed[1] !== "string" ||
      !Array.isArray(parsed[2]) ||
      parsed[2].length !== 3 ||
      !parsed[2].every(n => Number.isSafeInteger(n) && n >= 0)
    )
      throw new KnowledgeError("invalid_input", 400, "Invalid knowledge cursor");
    if (parsed[1] !== fingerprint)
      throw new KnowledgeError(
        "corpus_changed",
        409,
        "Knowledge corpus or cursor scope changed; restart this read",
      );
    position = parsed[2];
  }
  return {
    position,
    encode: (next: number[]) =>
      Buffer.from(JSON.stringify([1, fingerprint, next])).toString("base64url"),
  };
}
