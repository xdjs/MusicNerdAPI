import { NextResponse } from "next/server";
import { it, expect, vi, beforeEach } from "vitest";
import { postSourceExtractionHandler } from "@/lib/sourceExtraction/postSourceExtractionHandler";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
const m = vi.hoisted(() => ({ auth: vi.fn(), queue: vi.fn(), claim: vi.fn() }));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({ validateArtistEditRequest: m.auth }));
vi.mock("@/lib/sourceExtraction/queueSourceExtraction", () => ({ queueSourceExtraction: m.queue }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: m.claim }));
vi.mock("@/lib/db/db", () => ({ db: {} }));
const id = "11111111-1111-4111-8111-111111111111";
const request = () =>
  new Request("https://api.example/extract", {
    method: "POST",
    body: JSON.stringify({ sourceIds: [id] }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ artistId: id, userId: id });
  m.claim.mockResolvedValue(null);
  m.queue.mockResolvedValue({ status: "ok", jobId: id, queued: 1 });
});
it("returns 202 only for a persisted job", async () => {
  const r = await postSourceExtractionHandler(request(), id);
  expect(r.status).toBe(202);
  expect(await r.json()).toEqual({ status: "ok", jobId: id, queued: 1 });
  expect(r.headers.get("cache-control")).toBe("private, no-store");
});
it("requires authorization before reading selection or queueing", async () => {
  m.auth.mockResolvedValue(
    NextResponse.json({ status: "error", error: "Sign in" }, { status: 401 }),
  );
  expect((await postSourceExtractionHandler(request(), id)).status).toBe(401);
  expect(m.queue).not.toHaveBeenCalled();
});
it("reports no-op for existing text", async () => {
  m.queue.mockResolvedValue({ status: "ok", jobId: null, queued: 0 });
  expect((await postSourceExtractionHandler(request(), id)).status).toBe(200);
});
it("exposes safe conflicts but hides database exceptions", async () => {
  m.queue.mockRejectedValueOnce(new KnowledgeError("already_running", 409, "Already running"));
  expect((await postSourceExtractionHandler(request(), id)).status).toBe(409);
  m.queue.mockRejectedValueOnce(new Error("secret connection string"));
  const r = await postSourceExtractionHandler(request(), id);
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("secret");
});
