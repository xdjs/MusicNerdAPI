/** Current-page public visitor turns; never artist interview memory. */
export type PublicChatTurn = { question: string; answer: string; sourceUrls?: string[] };

/** Only public neutral descriptors and already verified public answers. */
export type QuestionReuseCandidate = {
  id: string;
  jobId: string;
  questionHash: string;
  intent: string;
  routing: Record<string, string | string[] | null>;
  answer: string;
  passages: { text: string; url: string; evidenceKind: string }[];
};
