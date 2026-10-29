import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { getPendingSubmissionsHandler } from "@/lib/contributorApprovals/getPendingSubmissionsHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: mock.auth }));
vi.mock("@/lib/contributorApprovals/listPendingSubmissions", () => ({
  listPendingSubmissions: mock.list,
}));

const id = "0b1e4c2a-7f3d-4a58-9c61-2d8e5f7a9b10";
const request = () => new Request(`https://api.musicnerd.test/api/admin/users/${id}/submissions`);

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "admin" });
});

describe("getPendingSubmissionsHandler", () => {
  it("returns the pending submissions", async () => {
    mock.list.mockResolvedValueOnce({ items: [], hasMore: false });
    const res = await getPendingSubmissionsHandler(request(), id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", items: [], hasMore: false });
    expect(mock.list).toHaveBeenCalledWith(id);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("rejects a non-UUID id", async () => {
    expect((await getPendingSubmissionsHandler(request(), "u1")).status).toBe(400);
    expect(mock.list).not.toHaveBeenCalled();
  });

  it("forwards the admin check's response", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    );
    expect((await getPendingSubmissionsHandler(request(), id)).status).toBe(403);
    expect(mock.list).not.toHaveBeenCalled();
  });

  it("answers a database failure with a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.list.mockRejectedValueOnce(new Error("db down"));
    const res = await getPendingSubmissionsHandler(request(), id);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
