import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { CorrectionAboutConflict } from "@/lib/bioCorrections/CorrectionAboutConflict";
import { getCorrectionAboutHandler } from "@/lib/bioCorrections/getCorrectionAboutHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: mock.auth }));
vi.mock("@/lib/bioCorrections/getCorrectionAbout", () => ({ getCorrectionAbout: mock.read }));

const id = "e7a5f235-4e66-40ba-9ff6-7276339fe34f";
const request = new Request(`https://api.musicnerd.test/api/admin/bio-corrections/${id}/about`);

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "admin" });
});

describe("getCorrectionAboutHandler", () => {
  it("returns the About and revision, never cached", async () => {
    mock.read.mockResolvedValueOnce({ bio: "Bio", revision: "rev", artistId: "a1", claimed: true });
    const res = await getCorrectionAboutHandler(request, id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", bio: "Bio", revision: "rev" });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(mock.read).toHaveBeenCalledWith(id);
  });

  it("reports a conflict as 409 with its message", async () => {
    mock.read.mockRejectedValueOnce(new CorrectionAboutConflict("This About is pinned."));
    const res = await getCorrectionAboutHandler(request, id);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ status: "error", error: "This About is pinned." });
  });

  it("reports any other failure with MusicNerdWeb's 500 message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.read.mockRejectedValueOnce(new Error("db down"));
    const res = await getCorrectionAboutHandler(request, id);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Could not load the current About. Try again.",
    });
  });

  it("is 400 for a bad id and forwards the admin check's response", async () => {
    expect((await getCorrectionAboutHandler(request, "r1")).status).toBe(400);
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await getCorrectionAboutHandler(request, id)).status).toBe(401);
    expect(mock.read).not.toHaveBeenCalled();
  });
});
