import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { getArtistActivityHandler } from "@/lib/adminActivity/getArtistActivityHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: mock.auth }));
vi.mock("@/lib/adminActivity/getArtistActivity", () => ({ getArtistActivity: mock.log }));

const request = (query = "") =>
  new Request(`https://api.musicnerd.test/api/admin/activity${query}`);

beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.mockResolvedValue({ userId: "admin" });
});

describe("getArtistActivityHandler", () => {
  it("returns the page of the log the query asks for", async () => {
    mock.log.mockResolvedValueOnce({ items: [], total: 0 });
    const res = await getArtistActivityHandler(request("?action=source_added&page=2"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", items: [], total: 0 });
    expect(mock.log).toHaveBeenCalledWith({
      query: "",
      action: "source_added",
      eventId: "",
      page: 2,
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("forwards the admin check's response", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    );
    expect((await getArtistActivityHandler(request())).status).toBe(403);
    expect(mock.log).not.toHaveBeenCalled();
  });

  it("answers a database failure with a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.log.mockRejectedValueOnce(new Error("db down"));
    expect((await getArtistActivityHandler(request())).status).toBe(500);
  });
});
