import { describe, it, expect, vi, beforeEach } from "vitest";
import { purgeClaimStorage } from "@/lib/claims/purgeClaimStorage";

const m = vi.hoisted(() => ({ list: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/storage/listStorageObjects", () => ({ listStorageObjects: m.list }));
vi.mock("@/lib/storage/removeObjects", () => ({ removeObjects: m.remove }));

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.remove.mockResolvedValue(undefined);
});

describe("purgeClaimStorage", () => {
  it("removes the artist's vault folder and only their own profile images", async () => {
    m.list.mockImplementation(async (_bucket: string, prefix: string) =>
      prefix === A
        ? [{ name: "doc.pdf" }, { name: "photo.jpg" }]
        : [{ name: `${A}_1.jpg` }, { name: `x${A}_2.jpg` }],
    );
    await purgeClaimStorage(A);
    expect(m.list).toHaveBeenCalledWith("vault-files", A, { limit: 1000, search: "" });
    expect(m.list).toHaveBeenCalledWith("vault-files", "profile-images", {
      limit: 1000,
      search: `${A}_`,
    });
    expect(m.remove).toHaveBeenCalledWith("vault-files", [`${A}/doc.pdf`, `${A}/photo.jpg`]);
    expect(m.remove).toHaveBeenCalledWith("vault-files", [`profile-images/${A}_1.jpg`]);
  });

  it("keeps reading pages until a short one", async () => {
    const page = Array.from({ length: 1000 }, (_, i) => ({ name: `f${i}` }));
    m.list
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce([{ name: "last" }])
      .mockResolvedValueOnce([]);
    await purgeClaimStorage(A);
    expect(m.remove).toHaveBeenCalledTimes(2);
  });

  it("never throws on a storage error", async () => {
    m.list.mockRejectedValue(new Error("storage down"));
    await expect(purgeClaimStorage(A)).resolves.toBeUndefined();
  });
});
