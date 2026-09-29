import { describe, it, expect, vi } from "vitest";

const { getVaultSourcesByStatus } = vi.hoisted(() => ({
  getVaultSourcesByStatus: vi.fn(async (_a: string, status: string) =>
    status === "rejected"
      ? [{ url: "https://www.example.com/not-me/" }]
      : status === "approved"
        ? [{ url: "https://example.com/kept" }]
        : [],
  ),
}));
vi.mock("@/lib/vault/getVaultSourcesByStatus", () => ({ getVaultSourcesByStatus }));
const { readExistingUrls } = await import("@/lib/vault/readExistingUrls");

describe("readExistingUrls", () => {
  it("dedupes against pending, approved AND rejected, and keeps the rejections apart", async () => {
    const { existingUrls, rejectedUrls } = await readExistingUrls("a1");
    expect(getVaultSourcesByStatus.mock.calls.map(c => c[1])).toEqual([
      "pending",
      "approved",
      "rejected",
    ]);
    expect([...existingUrls]).toEqual(["example.com/kept", "example.com/not-me"]);
    expect([...rejectedUrls]).toEqual(["example.com/not-me"]);
  });
});
