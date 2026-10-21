/** One link suggestion as the owner's review list shows it. No email or wallet leaves the server. */
export type LinkSuggestion = {
  id: string;
  kind: "ugc" | "source";
  url: string;
  title: string;
  platform: string;
  hidden?: boolean;
  status: "pending" | "approved" | "rejected";
  origin: string;
  submittedAt: string | null;
  suggestedBy: { id: string | null; name: string };
  reviewedAt: string | null;
  reviewedBy: { id: string | null; name: string } | null;
};

/** The owner's decision on one suggestion. */
export type LinkReviewDecision = {
  id: string;
  kind: "ugc" | "source";
  decision: "approve" | "dismiss" | "remove" | "restore";
};
