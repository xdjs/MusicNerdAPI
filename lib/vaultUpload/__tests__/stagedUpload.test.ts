import { describe, it, expect, vi, beforeEach } from "vitest";

const { remove } = vi.hoisted(() => ({ remove: vi.fn() }));
vi.mock("@/lib/storage/removeObjects", () => ({ removeObjects: remove }));
const { removeStagedUpload } = await import("@/lib/vaultUpload/removeStagedUpload");
const { cleanupSavedUpload } = await import("@/lib/vaultUpload/cleanupSavedUpload");

beforeEach(() => {
  remove.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("removeStagedUpload", () => {
  it("removes the object from the staging bucket and throws when storage refuses", async () => {
    remove.mockResolvedValue(undefined);
    await removeStagedUpload("a1/x.pdf");
    expect(remove).toHaveBeenCalledWith("lore-upload-staging", ["a1/x.pdf"]);
    remove.mockRejectedValue(new Error("HTTP 503"));
    await expect(removeStagedUpload("a1/x.pdf")).rejects.toThrow("HTTP 503");
  });
});

describe("cleanupSavedUpload", () => {
  it("swallows a failed cleanup, since the upload is already saved", async () => {
    remove.mockRejectedValue(new Error("HTTP 503"));
    await expect(cleanupSavedUpload("a1/x.pdf")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
