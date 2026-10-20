import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { CorrectionAboutConflict } from "@/lib/bioCorrections/CorrectionAboutConflict";

const { auth, save } = vi.hoisted(() => ({ auth: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: auth }));
vi.mock("@/lib/bioCorrections/saveCorrectionAbout", () => ({ saveCorrectionAbout: save }));
const { putCorrectionAboutHandler } =
  await import("@/lib/bioCorrections/putCorrectionAboutHandler");

const id = "00000000-0000-0000-0000-000000000001";
const revision = "b".repeat(64);
const req = (body: unknown) =>
  new Request(`https://x/api/admin/bio-corrections/${id}/about`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ userId: "admin" });
  save.mockReset();
});

describe("putCorrectionAboutHandler", () => {
  it("saves as the admin", async () => {
    const res = await putCorrectionAboutHandler(req({ bio: " New. ", revision }), id);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(save).toHaveBeenCalledWith(id, "admin", "New.", revision);
  });

  it("is a 409 for a conflict and a 500 otherwise", async () => {
    save.mockRejectedValueOnce(new CorrectionAboutConflict("changed"));
    const conflict = await putCorrectionAboutHandler(req({ bio: "x", revision }), id);
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ status: "error", error: "changed" });
    save.mockRejectedValueOnce(new Error("db"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect((await putCorrectionAboutHandler(req({ bio: "x", revision }), id)).status).toBe(500);
  });

  it("is a 400 for a bad body and passes through auth failures", async () => {
    expect((await putCorrectionAboutHandler(req({ bio: "x" }), id)).status).toBe(400);
    auth.mockResolvedValueOnce(NextResponse.json({}, { status: 403 }));
    expect((await putCorrectionAboutHandler(req({ bio: "x", revision }), id)).status).toBe(403);
    expect(save).not.toHaveBeenCalled();
  });
});
