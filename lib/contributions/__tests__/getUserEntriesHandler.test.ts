import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { getUserEntriesHandler } from "@/lib/contributions/getUserEntriesHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: mock.auth }));
vi.mock("@/lib/contributions/listUserEntries", () => ({ listUserEntries: mock.list }));

const result = {
  entries: [
    {
      id: "u1",
      createdAt: "2026-10-20T10:00:00",
      siteName: "bandcamp",
      ugcUrl: "https://bioritmo.bandcamp.com",
      accepted: true,
      artistName: "Bio Ritmo",
      artistId: "a1",
    },
  ],
  total: 1,
  pageCount: 1,
  platforms: ["bandcamp"],
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "token-user" });
  mock.list.mockResolvedValue(result);
});

describe("getUserEntriesHandler", () => {
  it("lists the token user's links with the normalized filters, uncached", async () => {
    const response = await getUserEntriesHandler(
      new Request("https://example.org/api/userEntries?page=2&siteName=bandcamp&status=approved"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(mock.list).toHaveBeenCalledWith("token-user", {
      page: 2,
      siteName: "bandcamp",
      all: false,
      status: "approved",
      query: undefined,
      order: "newest",
    });
    expect(await response.json()).toEqual({ status: "ok", ...result });
  });

  it("answers an empty page without `platforms` when signed out, as the website did", async () => {
    mock.auth.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const response = await getUserEntriesHandler(
      new Request("https://example.org/api/userEntries"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", entries: [], total: 0, pageCount: 0 });
    expect(mock.list).not.toHaveBeenCalled();
  });

  it("answers 500 when the links can't be read", async () => {
    mock.list.mockRejectedValue(new Error("db down"));
    const response = await getUserEntriesHandler(
      new Request("https://example.org/api/userEntries"),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
