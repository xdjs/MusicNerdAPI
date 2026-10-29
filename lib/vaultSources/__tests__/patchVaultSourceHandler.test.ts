import { NextResponse } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

const mock = vi.hoisted(() => ({
  validate: vi.fn(),
  status: vi.fn(),
  type: vi.fn(),
  refresh: vi.fn(),
  operation: vi.fn(),
}));
vi.mock("@/lib/vaultSources/validateSourceEditRequest", () => ({
  validateSourceEditRequest: mock.validate,
}));
vi.mock("@/lib/vault/updateVaultSourceStatus", () => ({ updateVaultSourceStatus: mock.status }));
vi.mock("@/lib/vault/updateVaultSourceType", () => ({ updateVaultSourceType: mock.type }));
vi.mock("@/lib/vaultSources/queueSourceChangeRefresh", () => ({
  queueSourceChangeRefresh: mock.refresh,
}));
vi.mock("@/lib/ownership/withArtistOperation", () => ({ withArtistOperation: mock.operation }));
const { patchVaultSourceHandler } = await import("@/lib/vaultSources/patchVaultSourceHandler");

const call = (body: unknown) =>
  patchVaultSourceHandler(
    new Request("https://api.test/x", { method: "PATCH", body: JSON.stringify(body) }),
    "a1",
    "s1",
  );

beforeEach(() => {
  vi.clearAllMocks();
  mock.validate.mockResolvedValue({ artistId: "a1", userId: "u1", sourceId: "s1", claimId: "c1" });
  mock.operation.mockImplementation((_a, _o, fn: () => unknown) => fn());
  mock.status.mockResolvedValue({ id: "s1" });
});

describe("patchVaultSourceHandler", () => {
  it("records a decision as a source review under the claim, then refreshes Lore", async () => {
    const res = await call({ status: "rejected" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(mock.operation).toHaveBeenCalledWith(
      "a1",
      { userId: "u1", expectedClaimId: "c1", trigger: "source_review" },
      expect.any(Function),
    );
    expect(mock.status).toHaveBeenCalledWith("s1", "rejected", undefined);
    expect(mock.refresh).toHaveBeenCalledWith("a1", "c1", "u1");
  });

  it("refreshes even when the decision was already in place", async () => {
    mock.status.mockResolvedValueOnce(undefined);
    expect((await call({ status: "approved" })).status).toBe(200);
    expect(mock.refresh).toHaveBeenCalled();
  });

  it("is a 409 when a pending-only decision finds the source already reviewed", async () => {
    mock.status.mockResolvedValueOnce(undefined);
    const res = await call({ status: "approved", expectedStatus: "pending" });
    expect(res.status).toBe(409);
    expect(mock.status).toHaveBeenCalledWith("s1", "approved", "pending");
    expect(mock.refresh).not.toHaveBeenCalled();
  });

  it("changes the type without a Lore refresh", async () => {
    expect((await call({ type: "interview" })).status).toBe(200);
    expect(mock.type).toHaveBeenCalledWith("s1", "interview");
    expect(mock.status).not.toHaveBeenCalled();
    expect(mock.refresh).not.toHaveBeenCalled();
  });

  it("is a 400 for a bad body, and passes on the request check's response", async () => {
    expect((await call({ status: "pending" })).status).toBe(400);
    const missing = NextResponse.json(
      { status: "error", error: "Source not found" },
      { status: 404 },
    );
    mock.validate.mockResolvedValueOnce(missing);
    expect(await call({ status: "approved" })).toBe(missing);
  });

  it("is a 403 when the claim changed, and a 500 when the write fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mock.status.mockRejectedValueOnce(new OwnershipChangedError());
    expect((await call({ status: "approved" })).status).toBe(403);
    mock.type.mockRejectedValueOnce(new Error("pool"));
    const res = await call({ type: "review" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Failed to update source" });
    error.mockRestore();
  });
});
