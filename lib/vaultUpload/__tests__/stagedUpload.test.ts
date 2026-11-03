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
  it("defers unversioned staging cleanup without any storage operation", async () => {
    remove.mockResolvedValue(undefined);
    await removeStagedUpload("a1/x.pdf");
    expect(remove).not.toHaveBeenCalled();
    remove.mockRejectedValue(new Error("HTTP 503"));
    await expect(removeStagedUpload("a1/x.pdf")).resolves.toBeUndefined();
  });
});

describe("cleanupSavedUpload", () => {
  it("swallows a failed cleanup, since the upload is already saved", async () => {
    remove.mockRejectedValue(new Error("HTTP 503"));
    await expect(cleanupSavedUpload("a1/x.pdf")).resolves.toBeUndefined();
    expect(remove).not.toHaveBeenCalled();
  });
});
