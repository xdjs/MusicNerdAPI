import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const { auth, execute } = vi.hoisted(() => ({ auth: vi.fn(), execute: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: auth }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { patchBioCorrectionHandler } =
  await import("@/lib/bioCorrections/patchBioCorrectionHandler");

const id = "00000000-0000-0000-0000-000000000001";
const req = (body: unknown) =>
  new Request(`https://x/api/admin/bio-corrections/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ userId: "admin" });
  execute.mockReset();
});

describe("patchBioCorrectionHandler", () => {
  it("reviews a pending report as the admin", async () => {
    execute.mockResolvedValueOnce([{ id }]);
    const res = await patchBioCorrectionHandler(req({ status: "dismissed" }), id);
    expect(await res.json()).toEqual({ status: "ok" });
    const q = new PgDialect().sqlToQuery(execute.mock.calls[0][0] as SQL);
    expect(q.params).toEqual(["dismissed", "admin", id]);
    expect(q.sql).toContain("status='pending'");
  });

  it("is a 409 when already reviewed", async () => {
    execute.mockResolvedValueOnce([]);
    expect((await patchBioCorrectionHandler(req({ status: "resolved" }), id)).status).toBe(409);
  });

  it("is a 400 for a bad status or id", async () => {
    expect((await patchBioCorrectionHandler(req({ status: "pending" }), id)).status).toBe(400);
    expect((await patchBioCorrectionHandler(req({ status: "resolved" }), "x")).status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("passes through auth failures", async () => {
    auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await patchBioCorrectionHandler(req({ status: "resolved" }), id)).status).toBe(401);
  });
});
