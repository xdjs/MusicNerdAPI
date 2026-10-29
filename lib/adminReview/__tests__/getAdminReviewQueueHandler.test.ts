import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { getAdminReviewQueueHandler } from "@/lib/adminReview/getAdminReviewQueueHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), queue: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: mock.auth }));
vi.mock("@/lib/adminReview/getAdminReviewQueue", () => ({ getAdminReviewQueue: mock.queue }));

const request = (query = "") =>
  new Request(`https://api.musicnerd.test/api/admin/review-queue${query}`);

beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.mockResolvedValue({ userId: "admin" });
});

describe("getAdminReviewQueueHandler", () => {
  it("returns the page of the queue the query asks for", async () => {
    mock.queue.mockResolvedValueOnce({ items: [], total: 0 });
    const res = await getAdminReviewQueueHandler(request("?type=links&query=dutch&page=2"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", items: [], total: 0 });
    expect(mock.queue).toHaveBeenCalledWith({ type: "links", query: "dutch", page: 2 });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("forwards the admin check's response", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await getAdminReviewQueueHandler(request())).status).toBe(401);
    expect(mock.queue).not.toHaveBeenCalled();
  });

  it("answers a database failure with a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.queue.mockRejectedValueOnce(new Error("db down"));
    const res = await getAdminReviewQueueHandler(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
