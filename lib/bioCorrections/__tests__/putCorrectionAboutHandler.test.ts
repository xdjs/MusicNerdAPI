import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { CorrectionAboutConflict } from "@/lib/bioCorrections/CorrectionAboutConflict";
import { putCorrectionAboutHandler } from "@/lib/bioCorrections/putCorrectionAboutHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: mock.auth }));
vi.mock("@/lib/bioCorrections/saveCorrectionAbout", () => ({ saveCorrectionAbout: mock.save }));

const id = "e7a5f235-4e66-40ba-9ff6-7276339fe34f";
const revision = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
const request = (body: string) =>
  new Request(`https://api.musicnerd.test/api/admin/bio-corrections/${id}/about`, {
    method: "PUT",
    body,
  });

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "admin" });
  mock.save.mockResolvedValue(undefined);
});

describe("putCorrectionAboutHandler", () => {
  it("saves the trimmed About as the admin", async () => {
    const res = await putCorrectionAboutHandler(
      request(JSON.stringify({ bio: " New bio ", revision })),
      id,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", success: true });
    expect(mock.save).toHaveBeenCalledWith(id, "admin", "New bio", revision);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("reports a conflict as 409 with its message", async () => {
    mock.save.mockRejectedValueOnce(
      new CorrectionAboutConflict("The About or artist ownership changed."),
    );
    const res = await putCorrectionAboutHandler(
      request(JSON.stringify({ bio: "x", revision })),
      id,
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      status: "error",
      error: "The About or artist ownership changed.",
    });
  });

  it("reports any other failure with MusicNerdWeb's 500 message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.save.mockRejectedValueOnce(new Error("db down"));
    const res = await putCorrectionAboutHandler(
      request(JSON.stringify({ bio: "x", revision })),
      id,
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Could not confirm the save. Your draft is kept; refresh the queue before retrying.",
    });
  });

  it("is 400 for a bad id or body, without saving", async () => {
    expect(
      (await putCorrectionAboutHandler(request(JSON.stringify({ bio: "x", revision })), "r1"))
        .status,
    ).toBe(400);
    expect(
      (await putCorrectionAboutHandler(request('{"bio":"x","revision":"nope"}'), id)).status,
    ).toBe(400);
    expect(mock.save).not.toHaveBeenCalled();
  });

  it("forwards the admin check's response", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    );
    expect((await putCorrectionAboutHandler(request("{}"), id)).status).toBe(403);
  });
});
