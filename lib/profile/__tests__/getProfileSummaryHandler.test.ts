import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), exec: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({
  authenticateRequest: m.auth,
}));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.exec } }));
const { getProfileSummaryHandler } = await import(
  "@/lib/profile/getProfileSummaryHandler"
);

const req = () =>
  new Request("https://api/api/profile/summary", {
    headers: { "X-Profile-Account": "u1" },
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
  m.exec.mockResolvedValue([
    { totalContributions: 5, approved: 3, pending: 2, total: 1 },
  ]);
});

describe("getProfileSummaryHandler", () => {
  it("returns 401 when not authenticated", async () => {
    m.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );
    const res = await getProfileSummaryHandler(req());
    expect(res.status).toBe(401);
  });

  it("returns summary stats for the user", async () => {
    const res = await getProfileSummaryHandler(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("u1");
    expect(typeof body.totalContributions).toBe("number");
  });
});
