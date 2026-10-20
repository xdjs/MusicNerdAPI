import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), exec: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({
  authenticateRequest: m.auth,
}));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.exec } }));
const { getProfileUpdatesHandler } = await import(
  "@/lib/profile/getProfileUpdatesHandler"
);

const req = () =>
  new Request("https://api/api/profile/updates", {
    headers: { "X-Profile-Account": "u1" },
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
  m.exec.mockResolvedValue([]);
});

describe("getProfileUpdatesHandler", () => {
  it("returns 401 when not authenticated", async () => {
    m.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );
    const res = await getProfileUpdatesHandler(req());
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid offset", async () => {
    const res = await getProfileUpdatesHandler(
      new Request("https://api/api/profile/updates?offset=abc", {
        headers: { "X-Profile-Account": "u1" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid filter kind", async () => {
    const res = await getProfileUpdatesHandler(
      new Request("https://api/api/profile/updates?kind=Bad", {
        headers: { "X-Profile-Account": "u1" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns updates for the user", async () => {
    m.exec
      .mockResolvedValueOnce([]) // artist rows
      .mockResolvedValueOnce([{ total: 0 }]); // count
    const res = await getProfileUpdatesHandler(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });
});
