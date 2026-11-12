import { beforeEach, expect, it, vi } from "vitest";
import { getAuthorizedVaultUpload } from "../getAuthorizedVaultUpload";
const m = vi.hoisted(() => ({ fence: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/ownership/withArtistUploadWrite", () => ({ withArtistUploadWrite: m.fence }));
vi.mock("@/lib/vault/getVaultUploadByPath", () => ({ getVaultUploadByPath: m.read }));
beforeEach(() => vi.resetAllMocks());
it("uses the locked transaction for retry/recovery reads", async () => {
  const tx = { query: {} };
  m.fence.mockImplementation(async (_a, _u, _c, read) => read(tx));
  m.read.mockResolvedValue({ id: "source" });
  expect(await getAuthorizedVaultUpload("artist", "path", "user", "claim")).toEqual({
    id: "source",
  });
  expect(m.fence).toHaveBeenCalledWith("artist", "user", "claim", expect.any(Function));
  expect(m.read).toHaveBeenCalledWith("artist", "path", tx);
});
it("does not return a source when ownership changed before recovery", async () => {
  m.fence.mockRejectedValue(new Error("ownership changed"));
  await expect(getAuthorizedVaultUpload("artist", "path", "user", "claim")).rejects.toThrow(
    "ownership changed",
  );
  expect(m.read).not.toHaveBeenCalled();
});
