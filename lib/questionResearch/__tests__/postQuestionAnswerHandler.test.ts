import { beforeEach, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { postQuestionAnswerHandler } from "@/lib/questionResearch/postQuestionAnswerHandler";
const m = vi.hoisted(() => ({ ask: vi.fn() }));
vi.mock("@/lib/questionResearch/postAskArtistHandler", () => ({ postAskArtistHandler: m.ask }));
const id = "11111111-1111-4111-8111-111111111111",
  jobId = "22222222-2222-4222-8222-222222222222";
const post = (body: unknown) =>
  new Request(`https://api.example/api/artist/${id}/questionResearch/${jobId}/answer`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.ask.mockResolvedValue(NextResponse.json({ status: "ok" }, { status: 202 }));
});
it("rebuilds the request with the URL's artist and job so the body cannot widen scope", async () => {
  const r = await postQuestionAnswerHandler(post({ question: "Who played drums?" }), id, jobId);
  expect(r.status).toBe(202);
  const forwarded: Request = m.ask.mock.calls[0][0];
  expect(await forwarded.json()).toEqual({ artistId: id, jobId, question: "Who played drums?" });
});
it("rejects a non-UUID artist or job before reading the body", async () => {
  const r = await postQuestionAnswerHandler(post({ question: "q" }), id, "nope");
  expect(r.status).toBe(400);
  expect(r.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await r.json()).toEqual({ status: "error", error: "Invalid research job" });
  expect(m.ask).not.toHaveBeenCalled();
});
it("rejects an invalid body with Web's message", async () => {
  const r = await postQuestionAnswerHandler(post({ artistId: id, question: "q" }), id, jobId);
  expect(r.status).toBe(400);
  expect(await r.json()).toEqual({ status: "error", error: "Invalid question" });
  expect(m.ask).not.toHaveBeenCalled();
});
