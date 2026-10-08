import type { artistInterviewAnswers } from "@/lib/db/schema";

export type ResponseRow = typeof artistInterviewAnswers.$inferSelect;
export type InterviewResponse = {
  id: string;
  questionKey: string;
  question: string;
  answer: string;
  source: string;
  sitting: number | null;
  offeredAt: string | null;
  answerUpdatedAt: string | null;
  revision: string;
};
export type ResponseVersion = {
  response: InterviewResponse;
  savedAt: string | null;
  note: string | null;
  isCurrent: boolean;
};
export type ResponseOperation = "list" | "read" | "versions" | "revise";
export type ResponseQuery = { limit?: number; cursor?: string; revision?: string };
