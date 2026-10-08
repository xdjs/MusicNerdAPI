import { it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { getInterviewMemoryHandler } from "@/lib/interviewMemory/getInterviewMemoryHandler";
import { postInterviewBoundaryHandler } from "@/lib/interviewMemory/postInterviewBoundaryHandler";
import { validateBoundaryBody } from "@/lib/interviewMemory/validateBoundaryBody";
const m = vi.hoisted(() => ({ auth: vi.fn(), load: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/interviewMemory/loadInterviewMemory", () => ({ loadInterviewMemory: m.load }));
vi.mock("@/lib/interviewMemory/saveInterviewBoundary", () => ({ saveInterviewBoundary: m.save }));
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ userId: "user" });
  m.load.mockResolvedValue({ artistId: id, sitting: 2, entries: [] });
});
it("keeps valid empty memory explicitly complete and never cacheable", async () => {
  const r = await getInterviewMemoryHandler(new Request("https://api.example?sitting=2"), id);
  expect(r.status).toBe(200);
  expect(r.headers.get("cache-control")).toBe("private, no-store");
  expect(await r.json()).toMatchObject({ constraintsComplete: true, totalEntries: 0 });
});
it("does not turn failed private reads into empty constraints", async () => {
  m.load.mockRejectedValue(new Error("private database failure"));
  const r = await getInterviewMemoryHandler(new Request("https://api.example?sitting=2"), id);
  expect(r.status).toBe(503);
  expect(JSON.stringify(await r.json())).not.toContain("private database");
});
it("cannot use public research credentials in place of artist authentication", async () => {
  m.auth.mockResolvedValue(NextResponse.json({ status: "error" }, { status: 401 }));
  const r = await getInterviewMemoryHandler(
    new Request("https://api.example?sitting=2", {
      headers: { "X-MusicNerd-Research-Key": "public-only" },
    }),
    id,
  );
  expect(r.status).toBe(401);
  expect(m.load).not.toHaveBeenCalled();
});
it("rejects unknown memory controls and malformed boundary requests", async () => {
  expect(
    (
      await getInterviewMemoryHandler(
        new Request("https://api.example?sitting=2&omitCorrections=true"),
        id,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await postInterviewBoundaryHandler(
        new Request("https://api.example", { method: "POST", body: "invalid json" }),
        id,
      )
    ).status,
  ).toBe(400);
  expect(m.save).not.toHaveBeenCalled();
});
it("preserves exact boundary wording and rejects account IDs or an inferred lifetime", () => {
  const input = { requestId: id, questionKey: "q", wording: " Exact words. ", scope: "sitting" };
  expect(validateBoundaryBody(input).wording).toBe(input.wording);
  expect(() => validateBoundaryBody({ ...input, accountId: id })).toThrow();
  expect(() => validateBoundaryBody({ ...input, scope: "guess" })).toThrow();
});
