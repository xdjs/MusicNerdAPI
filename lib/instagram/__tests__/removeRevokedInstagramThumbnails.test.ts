import { describe, it, expect, vi, beforeEach } from "vitest";
import { removeRevokedInstagramThumbnails } from "@/lib/instagram/removeRevokedInstagramThumbnails";

const artist = "50f23458-df64-4381-8042-7333e8b64531";
const jobId = "11111111-1111-4111-8111-111111111111";
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
});

describe("removeRevokedInstagramThumbnails", () => {
  it("deletes exactly the revoked job's paths", async () => {
    const path = `${artist}/instagram-${jobId}-123-${"a".repeat(64)}.webp`;
    fetchMock.mockResolvedValueOnce({ ok: true });
    await removeRevokedInstagramThumbnails(artist, { jobId, attemptedPaths: new Set([path]) });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://test.supabase.co/storage/v1/object/vault-files");
    expect(options.method).toBe("DELETE");
    expect(JSON.parse(options.body)).toEqual({ prefixes: [path] });
  });

  it("does nothing when nothing was attempted", async () => {
    await removeRevokedInstagramThumbnails(artist, { jobId, attemptedPaths: new Set() });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects paths outside the revoked job and reports storage failures", async () => {
    const scope = { jobId, attemptedPaths: new Set(["another-artist/file.webp"]) };
    await expect(removeRevokedInstagramThumbnails(artist, scope)).rejects.toThrow(
      "Invalid thumbnail cleanup path",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    scope.attemptedPaths = new Set([`${artist}/instagram-${jobId}-123-${"a".repeat(64)}.webp`]);
    fetchMock.mockResolvedValueOnce({ ok: false });
    await expect(removeRevokedInstagramThumbnails(artist, scope)).rejects.toThrow("cleanup failed");
  });
});
