import { it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { handleInterviewSessionRequest } from "../handleInterviewSessionRequest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  read: vi.fn(),
  start: vi.fn(),
  offer: vi.fn(),
  answer: vi.fn(),
  finish: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("../getInterviewSession", () => ({ getInterviewSession: m.read }));
vi.mock("../startInterviewSession", () => ({ startInterviewSession: m.start }));
vi.mock("../saveInterviewOffer", () => ({ saveInterviewOffer: m.offer }));
vi.mock("../saveInterviewAnswer", () => ({ saveInterviewAnswer: m.answer }));
vi.mock("../finishInterviewSession", () => ({ finishInterviewSession: m.finish }));
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ userId: "user" });
  m.read.mockResolvedValue({ status: "ok", session: null, legacyOffers: [] });
});
it("requires real authentication and cannot substitute the public research key", async () => {
  m.auth.mockResolvedValue(NextResponse.json({ status: "error" }, { status: 401 }));
  const r = await handleInterviewSessionRequest(
    new Request("https://api.example", { headers: { "X-MusicNerd-Research-Key": "public" } }),
    id,
    "read",
  );
  expect(r.status).toBe(401);
  expect(m.read).not.toHaveBeenCalled();
});
it("reads existing state with no mutation and no cache", async () => {
  const r = await handleInterviewSessionRequest(new Request("https://api.example"), id, "read");
  expect(r.status).toBe(200);
  expect(r.headers.get("cache-control")).toBe("private, no-store");
  expect(m.start).not.toHaveBeenCalled();
  expect(m.offer).not.toHaveBeenCalled();
});
it("rejects unknown controls, oversized bodies and disguised account inputs", async () => {
  expect(
    (
      await handleInterviewSessionRequest(
        new Request("https://api.example?generate=true"),
        id,
        "read",
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await handleInterviewSessionRequest(
        new Request("https://api.example", { method: "POST", body: "a".repeat(65537) }),
        id,
        "offer",
        id,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await handleInterviewSessionRequest(
        new Request("https://api.example", {
          method: "POST",
          body: JSON.stringify({ accountId: id }),
        }),
        id,
        "finish",
        id,
      )
    ).status,
  ).toBe(400);
  expect(m.finish).not.toHaveBeenCalled();
});
it("does not expose a raw storage failure", async () => {
  m.read.mockRejectedValue(new Error("PRIVATE DATABASE"));
  const r = await handleInterviewSessionRequest(new Request("https://api.example"), id, "read");
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("PRIVATE DATABASE");
});
