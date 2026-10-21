import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { getSelfEditsHandler } from "@/lib/contributions/getSelfEditsHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), history: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: mock.auth }));
vi.mock("@/lib/contributions/getArtistSelfEdits", () => ({ getArtistSelfEdits: mock.history }));

const history = {
  entries: [
    {
      id: "e1",
      artistId: "a1",
      artistName: "Bio Ritmo",
      siteName: "instagram",
      oldValue: null,
      newValue: "bioritmomusic",
      createdAt: "2026-10-20T10:00:00+00:00",
    },
  ],
  total: 1,
  page: 1,
  pageCount: 1,
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "token-user" });
  mock.history.mockResolvedValue(history);
});

describe("getSelfEditsHandler", () => {
  it("returns the token user's page, uncached", async () => {
    const response = await getSelfEditsHandler(
      new Request("https://example.org/api/selfEdits?page=2"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(mock.history).toHaveBeenCalledWith("token-user", 2);
    expect(await response.json()).toEqual({ status: "ok", ...history });
  });

  it("requires a signed-in user before reading the page", async () => {
    mock.auth.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const response = await getSelfEditsHandler(
      new Request("https://example.org/api/selfEdits?page=abc"),
    );
    expect(response.status).toBe(401);
    expect(mock.history).not.toHaveBeenCalled();
  });

  it("rejects a bad page with 400, and answers 500 when the history can't be read", async () => {
    const bad = await getSelfEditsHandler(new Request("https://example.org/api/selfEdits?page=0"));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ status: "error", error: "Invalid page" });
    expect(mock.history).not.toHaveBeenCalled();
    mock.history.mockRejectedValue(new Error("db down"));
    const failed = await getSelfEditsHandler(new Request("https://example.org/api/selfEdits"));
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({
      status: "error",
      error: "Unable to load profile edits",
    });
  });
});
