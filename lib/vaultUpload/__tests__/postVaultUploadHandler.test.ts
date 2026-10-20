import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/authenticateRequest", () => ({
  authenticateRequest: (...args: unknown[]) => mockAuth(...args),
}));

const { postVaultUploadHandler } = await import("@/lib/vaultUpload/postVaultUploadHandler");

describe("postVaultUploadHandler", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ userId: "user-1" });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const request = new Request("http://localhost/api/vault/upload", { method: "POST" });
    const response = await postVaultUploadHandler(request);
    expect(response.status).toBe(401);
  });

  it("returns 501 when authenticated", async () => {
    const request = new Request("http://localhost/api/vault/upload", { method: "POST" });
    const response = await postVaultUploadHandler(request);
    expect(response.status).toBe(501);
    const body = await response.json();
    expect(body.error).toContain("not yet migrated");
  });
});
