import { describe, it, expect, vi, beforeEach } from "vitest";
import { storedInstagramThumbnail } from "@/lib/instagram/storedInstagramThumbnail";

const artist = "50f23458-df64-4381-8042-7333e8b64531";

beforeEach(() => vi.stubEnv("SUPABASE_URL", "https://test.supabase.co"));

describe("storedInstagramThumbnail", () => {
  it("only reuses stored thumbnails for this environment, artist and post", () => {
    const sha256 = "a".repeat(64);
    const url = `https://test.supabase.co/storage/v1/object/public/vault-files/${artist}/instagram-123-${sha256}.webp`;
    const metadata = { version: 1, sha256, url };
    expect(storedInstagramThumbnail({ _musicnerdThumbnail: metadata }, artist, "123")).toEqual(
      metadata,
    );
    expect(storedInstagramThumbnail({ _musicnerdThumbnail: metadata }, artist, "124")).toBeNull();
    expect(
      storedInstagramThumbnail(
        {
          _musicnerdThumbnail: {
            ...metadata,
            url: url.replace("test.supabase.co", "other.supabase.co"),
          },
        },
        artist,
        "123",
      ),
    ).toBeNull();
  });

  it("accepts a job-scoped thumbnail name", () => {
    const sha256 = "b".repeat(64);
    const job = "11111111-1111-4111-8111-111111111111";
    const url = `https://test.supabase.co/storage/v1/object/public/vault-files/${artist}/instagram-${job}-5-${sha256}.webp`;
    expect(
      storedInstagramThumbnail({ _musicnerdThumbnail: { version: 1, sha256, url } }, artist, "5"),
    ).not.toBeNull();
  });
});
