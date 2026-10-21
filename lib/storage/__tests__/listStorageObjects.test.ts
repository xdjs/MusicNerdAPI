import { describe, it, expect, vi, beforeEach } from "vitest";

const { storageFetch } = vi.hoisted(() => ({ storageFetch: vi.fn() }));
vi.mock("@/lib/storage/storageFetch", () => ({ storageFetch }));
const { listStorageObjects } = await import("@/lib/storage/listStorageObjects");

beforeEach(() => {
  storageFetch.mockReset();
});

describe("listStorageObjects", () => {
  it("lists a folder with a limit and a name search", async () => {
    storageFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([{ name: "avatar.webp", id: "x" }]), { status: 200 }),
    );
    const files = await listStorageObjects("user-profile-images", "u1", {
      limit: 1,
      search: "avatar.webp",
    });
    expect(files).toEqual([{ name: "avatar.webp", id: "x" }]);
    expect(storageFetch).toHaveBeenCalledWith("object/list/user-profile-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "u1", limit: 1, search: "avatar.webp" }),
    });
  });

  it("throws on a Storage error", async () => {
    storageFetch.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    await expect(listStorageObjects("b", "p", { limit: 1, search: "a" })).rejects.toThrow(
      "Storage list failed: HTTP 500",
    );
  });
});
