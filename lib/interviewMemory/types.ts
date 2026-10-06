export type MemoryField = {
  name: string;
  text: string | null;
  start: number;
  end: number;
  totalChars: number;
  complete: boolean;
};
export type MemoryEntry = {
  entryId: string;
  revision: string;
  kind: "latest_answer" | "correction" | "boundary";
  metadata: Record<string, string | number | null>;
  fields: MemoryField[];
};
export type MemorySnapshot = { artistId: string; sitting: number; entries: MemoryEntry[] };
export type BoundaryRow = {
  id: string;
  artist_id: string;
  request_id: string;
  wording: string;
  scope: "sitting" | "until_retracted";
  sitting: number;
  origin_answer_id: string | null;
  origin_question_key: string;
  origin_question: string;
  created_at: string | Date;
  retracted_at: string | Date | null;
};
export type BoundaryInput = {
  requestId: string;
  questionKey: string;
  wording: string;
  scope: "sitting" | "until_retracted";
};
export type MemoryPage = {
  status: "ok";
  snapshotId: string;
  sitting: number;
  latestAnswer: { entryId: string; revision: string } | null;
  totalEntries: number;
  entries: MemoryEntry[];
  constraintsComplete: boolean;
  budget: { returnedChars: number; nextCursor: string | null };
};
