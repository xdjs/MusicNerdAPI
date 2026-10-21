import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { patchBioCorrectionHandler } from "@/lib/bioCorrections/patchBioCorrectionHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), review: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: mock.auth }));
vi.mock("@/lib/bioCorrections/reviewBioCorrection", () => ({ reviewBioCorrection: mock.review }));

const id = "e7a5f235-4e66-40ba-9ff6-7276339fe34f";
const request = (body: string) =>
  new Request(`https://api.musicnerd.test/api/admin/bio-corrections/${id}`, {
    method: "PATCH",
    body,
  });

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "admin" });
});

describe("patchBioCorrectionHandler", () => {
  it("reviews the report as the admin", async () => {
    mock.review.mockResolvedValueOnce(true);
    const res = await patchBioCorrectionHandler(request('{"status":"dismissed"}'), id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", success: true });
    expect(mock.review).toHaveBeenCalledWith(id, "dismissed", "admin");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("is 409 when the report was already reviewed or does not exist", async () => {
    mock.review.mockResolvedValueOnce(false);
    const res = await patchBioCorrectionHandler(request('{"status":"resolved"}'), id);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Report was already reviewed or does not exist",
    });
  });

  it("is 400 for a bad id or status, without reviewing", async () => {
    expect((await patchBioCorrectionHandler(request('{"status":"resolved"}'), "r1")).status).toBe(
      400,
    );
    expect((await patchBioCorrectionHandler(request('{"status":"approved"}'), id)).status).toBe(
      400,
    );
    expect(mock.review).not.toHaveBeenCalled();
  });

  it("forwards the admin check's response", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    );
    expect((await patchBioCorrectionHandler(request('{"status":"resolved"}'), id)).status).toBe(
      403,
    );
  });
});
