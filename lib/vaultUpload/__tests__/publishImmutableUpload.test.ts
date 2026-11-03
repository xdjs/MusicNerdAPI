import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ upload: vi.fn(), download: vi.fn() }));
vi.mock("@/lib/storage/uploadStorageObject", () => ({ uploadStorageObject: m.upload }));
vi.mock("@/lib/storage/downloadObject", () => ({ downloadObject: m.download }));
import { publishImmutableUpload } from "../publishImmutableUpload";
beforeEach(() => {
  vi.resetAllMocks();
});
it("never overwrites an existing key", async () => {
  await publishImmutableUpload("key", Buffer.from("same"), "text/plain");
  expect(m.upload).toHaveBeenCalledWith(
    "vault-files",
    "key",
    Buffer.from("same"),
    expect.objectContaining({ upsert: false }),
  );
});
it("reconciles a duplicate or lost acknowledgement only if existing bytes match", async () => {
  m.upload.mockRejectedValue(new Error("conflict or lost response"));
  m.download.mockResolvedValue(Buffer.from("same"));
  await expect(
    publishImmutableUpload("key", Buffer.from("same"), "text/plain"),
  ).resolves.toBeUndefined();
});
it("fails closed on replacement bytes or unreadable identity", async () => {
  m.upload.mockRejectedValue(new Error("conflict"));
  m.download.mockResolvedValue(Buffer.from("different"));
  await expect(publishImmutableUpload("key", Buffer.from("same"), "text/plain")).rejects.toThrow();
  m.download.mockRejectedValue(new Error("unavailable"));
  await expect(publishImmutableUpload("key", Buffer.from("same"), "text/plain")).rejects.toThrow();
});
it("reconciles simultaneous same-ticket completions without overwrite or delete", async () => {
  const bytes = Buffer.from("same");
  let published = false;
  m.upload.mockImplementation(async () => {
    if (published) throw new Error("already exists");
    published = true;
  });
  m.download.mockResolvedValue(bytes);
  await Promise.all([
    publishImmutableUpload("key", bytes, "text/plain"),
    publishImmutableUpload("key", bytes, "text/plain"),
  ]);
  expect(m.upload).toHaveBeenCalledTimes(2);
  expect(m.upload.mock.calls.every(call => call[3].upsert === false)).toBe(true);
});
