import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { auth, execute } = vi.hoisted(() => ({ auth: vi.fn(), execute: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: auth }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getPendingUGCCountHandler } =
  await import("@/lib/pendingUGCCount/getPendingUGCCountHandler");

const req = () => new Request("https://x/api/pendingUGCCount");

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ userId: "admin" });
  execute.mockReset();
});

describe("getPendingUGCCountHandler", () => {
  it("returns the pending count", async () => {
    execute.mockResolvedValueOnce([{ count: 7 }]);
    const res = await getPendingUGCCountHandler(req());
    expect(await res.json()).toEqual({ status: "ok", count: 7 });
  });

  it("passes through the auth failure", async () => {
    auth.mockResolvedValueOnce(NextResponse.json({}, { status: 403 }));
    expect((await getPendingUGCCountHandler(req())).status).toBe(403);
    expect(execute).not.toHaveBeenCalled();
  });

  it("is a 500 when the query fails", async () => {
    execute.mockRejectedValueOnce(new Error("db"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect((await getPendingUGCCountHandler(req())).status).toBe(500);
  });
});
