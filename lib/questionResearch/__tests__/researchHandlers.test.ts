import { it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { postQuestionResearchHandler } from "@/lib/questionResearch/postQuestionResearchHandler";
import { getQuestionResearchHandler } from "@/lib/questionResearch/getQuestionResearchHandler";
const m = vi.hoisted(() => ({ auth: vi.fn(), queue: vi.fn(), status: vi.fn() }));
vi.mock("@/lib/questionResearch/authenticateResearchRequest", () => ({
  authenticateResearchRequest: m.auth,
}));
vi.mock("@/lib/questionResearch/queueQuestionResearch", () => ({ queueQuestionResearch: m.queue }));
vi.mock("@/lib/questionResearch/getQuestionResearchStatus", () => ({
  getQuestionResearchStatus: m.status,
}));
const artist = "11111111-1111-4111-8111-111111111111",
  job = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ kind: "service" });
  m.queue.mockResolvedValue({ status: "ok", jobId: job, stage: "checking_saved" });
});
it("acknowledges durable enqueue with 202 and no-store", async () => {
  const r = await postQuestionResearchHandler(
    new Request("https://api.example", {
      method: "POST",
      body: JSON.stringify({ topic: "album credits", evidenceNeed: "credits" }),
    }),
    artist,
  );
  expect(r.status).toBe(202);
  expect(r.headers.get("cache-control")).toBe("private, no-store");
  expect(await r.json()).toMatchObject({ stage: "checking_saved" });
});
it("rejects invalid artist IDs even with a public service grant", async () => {
  expect(
    (await postQuestionResearchHandler(new Request("https://api.example"), "nope")).status,
  ).toBe(400);
  expect(m.queue).not.toHaveBeenCalled();
});
it("preserves failed authentication without reaching database work", async () => {
  m.auth.mockResolvedValue(
    NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
  );
  expect(
    (await getQuestionResearchHandler(new Request("https://api.example"), artist, job)).status,
  ).toBe(401);
  expect(m.status).not.toHaveBeenCalled();
});
it("does not expose private error text as a provider or absence result", async () => {
  m.status.mockRejectedValue(new Error("credential=private db statement"));
  const r = await getQuestionResearchHandler(new Request("https://api.example"), artist, job);
  expect(r.status).toBe(503);
  expect(JSON.stringify(await r.json())).not.toContain("credential");
});
