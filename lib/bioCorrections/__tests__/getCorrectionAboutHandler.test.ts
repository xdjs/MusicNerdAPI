import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { CorrectionAboutConflict } from "@/lib/bioCorrections/CorrectionAboutConflict";

const { auth, read } = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: auth }));
vi.mock("@/lib/bioCorrections/getCorrectionAbout", () => ({ getCorrectionAbout: read }));
const { getCorrectionAboutHandler } =
  await import("@/lib/bioCorrections/getCorrectionAboutHandler");

const id = "00000000-0000-0000-0000-000000000001";
const req = () => new Request(`https://x/api/admin/bio-corrections/${id}/about`);

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ userId: "admin" });
  read.mockReset();
});

describe("getCorrectionAboutHandler", () => {
  it("returns the bio and revision, uncached", async () => {
    read.mockResolvedValueOnce({ bio: "B", revision: "r", artistId: "a", claimed: true });
    const res = await getCorrectionAboutHandler(req(), id);
    expect(await res.json()).toEqual({ status: "ok", bio: "B", revision: "r" });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("is a 409 with the conflict message", async () => {
    read.mockRejectedValueOnce(new CorrectionAboutConflict("pinned"));
    const res = await getCorrectionAboutHandler(req(), id);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ status: "error", error: "pinned" });
  });

  it("is a 500 for other errors", async () => {
    read.mockRejectedValueOnce(new Error("db"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect((await getCorrectionAboutHandler(req(), id)).status).toBe(500);
  });

  it("is a 400 for a bad id and passes through auth failures", async () => {
    expect((await getCorrectionAboutHandler(req(), "bad")).status).toBe(400);
    auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await getCorrectionAboutHandler(req(), id)).status).toBe(401);
  });
});
