import { z } from "zod";
import type { InterviewConversation, InterviewCorpus } from "./types";

/** Validate labelled replay and withhold its entire source group before retrieval.
 * @param corpus - Unmodified frozen snapshot.
 * @param input - Optional private synthetic or published conversation, never a database answer.
 * @returns Eligible corpus, validated original turns and withheld IDs.
 */
export function prepareInterviewConversation(
  corpus: InterviewCorpus,
  input?: unknown,
): {
  corpus: InterviewCorpus;
  conversation: InterviewConversation | null;
  turns: InterviewConversation["turns"];
  withheldIds: string[];
} {
  if (input === undefined) return { corpus, conversation: null, turns: [], withheldIds: [] };
  const parsed = z
    .object({
      kind: z.enum(["synthetic", "published"]),
      artistId: z.string(),
      label: z.string().optional(),
      sourceId: z.string().optional(),
      turns: z
        .array(
          z.object({
            speaker: z.enum(["interviewer", "artist"]),
            text: z.string().min(1),
            start: z.number().int().nonnegative().optional(),
            end: z.number().int().nonnegative().optional(),
          }),
        )
        .min(1)
        .max(20),
    })
    .parse(input);
  if (parsed.artistId !== corpus.artist.id || parsed.turns.at(-1)?.speaker !== "artist")
    throw new Error("Replay needs the matching artist and a final artist turn");
  if (Buffer.byteLength(JSON.stringify(parsed)) > 12000)
    throw new Error("Conversation exceeds 12,000 bytes; narrow the exercise explicitly");
  let withheldIds: string[] = [];
  if (parsed.kind === "synthetic") {
    if (!parsed.label?.trim())
      throw new Error("Synthetic conversation needs an explicit fixture label");
  } else {
    const source = corpus.evidence.find(e => e.id === parsed.sourceId);
    if (!source) throw new Error("Published conversation source is missing");
    let previousEnd = 0;
    for (const turn of parsed.turns) {
      if (
        turn.start === undefined ||
        turn.end === undefined ||
        turn.start < previousEnd ||
        turn.end <= turn.start ||
        source.text.slice(turn.start, turn.end) !== turn.text
      )
        throw new Error("Published turns must match ordered exact source offsets");
      previousEnd = turn.end;
    }
    withheldIds = corpus.evidence.filter(e => e.group === source.group).map(e => e.id);
  }
  return {
    corpus: { ...corpus, evidence: corpus.evidence.filter(e => !withheldIds.includes(e.id)) },
    conversation: parsed,
    turns: parsed.turns,
    withheldIds,
  };
}
