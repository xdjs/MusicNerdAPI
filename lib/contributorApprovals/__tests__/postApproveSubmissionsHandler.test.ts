import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { postApproveSubmissionsHandler } from "@/lib/contributorApprovals/postApproveSubmissionsHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), approve: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: mock.auth }));
vi.mock("@/lib/contributorApprovals/approveContributorSubmissions", () => ({
  approveContributorSubmissions: mock.approve,
}));

const id = "0b1e4c2a-7f3d-4a58-9c61-2d8e5f7a9b10";
const items = [{ id, type: "link" }];
const request = (body: unknown) =>
  new Request(`https://api.musicnerd.test/api/admin/users/${id}/submissions/approve`, {
    method: "POST",
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "admin" });
});

describe("postApproveSubmissionsHandler", () => {
  it("approves as the calling admin and returns the counts", async () => {
    mock.approve.mockResolvedValueOnce({ approved: 1, skipped: 0, failed: 0 });
    const res = await postApproveSubmissionsHandler(request({ items }), id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", approved: 1, skipped: 0, failed: 0 });
    expect(mock.approve).toHaveBeenCalledWith("admin", id, items);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("rejects a non-UUID contributor", async () => {
    expect((await postApproveSubmissionsHandler(request({ items }), "u1")).status).toBe(400);
    expect(mock.approve).not.toHaveBeenCalled();
  });

  it("rejects an invalid selection", async () => {
    expect((await postApproveSubmissionsHandler(request({ items: [] }), id)).status).toBe(400);
    expect(mock.approve).not.toHaveBeenCalled();
  });

  it("forwards the admin check's response", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await postApproveSubmissionsHandler(request({ items }), id)).status).toBe(401);
  });

  it("answers an unexpected failure with a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.approve.mockRejectedValueOnce(new Error("db down"));
    const res = await postApproveSubmissionsHandler(request({ items }), id);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
