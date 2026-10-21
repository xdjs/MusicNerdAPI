import { describe, it, expect } from "vitest";
import { interviewRequestSchema } from "@/lib/interview/interviewRequestSchema";

const uuid = "22222222-2222-4222-8222-222222222222";
const revision = "a".repeat(64);

describe("interviewRequestSchema", () => {
  it.each([
    { action: "start", requestId: uuid },
    { action: "continue", sessionId: uuid },
    { action: "prepare", sessionId: uuid },
    { action: "answer", answerId: uuid, expectedRevision: revision, answer: "Live, one take." },
    { action: "answer", answerId: uuid, expectedRevision: revision, answer: null },
    { action: "finish", sessionId: uuid },
    {
      action: "boundary",
      requestId: uuid,
      questionKey: "key",
      wording: "Skip questions about touring.",
      scope: "until_retracted",
    },
    { action: "retract", boundaryId: uuid, revision },
    { action: "memory" },
    { action: "boundaries" },
    { action: "boundaries", cursor: "next" },
    { action: "source", sourceId: `vault:${uuid}`, revision, start: 0 },
  ])("accepts the website's $action request", input => {
    expect(interviewRequestSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    { action: "generate" },
    { action: "start", requestId: "not-a-uuid" },
    { action: "start", requestId: uuid, apiOrigin: "https://attacker.example" },
    { action: "answer", answerId: uuid, expectedRevision: revision, answer: "   " },
    { action: "answer", answerId: uuid, expectedRevision: "short", answer: "x" },
    { action: "boundaries", sitting: 99 },
    { action: "boundaries", cursor: "x".repeat(4097) },
    { action: "boundary", requestId: uuid, questionKey: "key", wording: " ", scope: "sitting" },
    { action: "source", sourceId: `vault:${uuid}`, revision, start: -1 },
  ])("rejects %o", input => {
    expect(interviewRequestSchema.safeParse(input).success).toBe(false);
  });
});
