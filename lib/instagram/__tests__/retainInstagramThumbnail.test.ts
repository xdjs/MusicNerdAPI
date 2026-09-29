import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import sharp from "sharp";
import { retainInstagramThumbnail } from "@/lib/instagram/retainInstagramThumbnail";
import { media } from "./media";

const artist = "50f23458-df64-4381-8042-7333e8b64531";
const source = "https://scontent.cdninstagram.com/photo.jpg?oe=temporary";
const fetchMock = vi.fn();
let jpeg: Buffer;

beforeAll(async () => {
  jpeg = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#cc88dd" } })
    .jpeg()
    .toBuffer();
});

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
});

describe("retainInstagramThumbnail", () => {
  it("stores a resized WebP under an immutable public URL and keeps attribution", async () => {
    fetchMock.mockResolvedValueOnce(media(jpeg)).mockResolvedValueOnce({ ok: true });
    const raw = {
      displayUrl: source,
      url: "https://www.instagram.com/p/ABC/",
      caption: "Original",
    };
    const retained = (await retainInstagramThumbnail(raw, artist, "123")) as Record<string, any>;
    expect(retained.url).toBe(raw.url);
    expect(retained.caption).toBe(raw.caption);
    expect(retained.displayUrl).toMatch(
      new RegExp(`/public/vault-files/${artist}/instagram-123-[a-f0-9]{64}\\.webp$`),
    );
    expect(retained._musicnerdThumbnail).toMatchObject({
      width: 640,
      height: 427,
      sourceUrl: source,
    });
    const [uploadUrl, options] = fetchMock.mock.calls[1];
    expect(uploadUrl).toContain("/storage/v1/object/vault-files/");
    expect(options.headers["x-upsert"]).toBe("false");
    expect((await sharp(options.body).metadata()).format).toBe("webp");
    expect(raw.displayUrl).toBe(source);
    expect(fetchMock.mock.calls[0][1].redirect).toBe("error");
  });

  it("accepts a duplicate immutable upload on retry", async () => {
    fetchMock
      .mockResolvedValueOnce(media(jpeg))
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Duplicate" }) });
    expect(await retainInstagramThumbnail({ displayUrl: source }, artist, "1")).toHaveProperty(
      "_musicnerdThumbnail.version",
      1,
    );
  });

  it.each(["type", "bytes", "declared-size", "stream-size", "upload"])(
    "does not publish an invalid or failed %s thumbnail",
    async failure => {
      const response =
        failure === "type"
          ? media(jpeg, "image/svg+xml")
          : failure === "bytes"
            ? media(Buffer.from("not a jpeg"))
            : failure === "declared-size"
              ? media(jpeg, "image/jpeg", String(9 * 1024 * 1024))
              : failure === "stream-size"
                ? media(Buffer.alloc(9 * 1024 * 1024))
                : media(jpeg);
      fetchMock
        .mockResolvedValueOnce(response)
        .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Unauthorized" }) });
      const result = await retainInstagramThumbnail(
        { displayUrl: source, _musicnerdThumbnail: { url: "https://fake.test" } },
        artist,
        "1",
      );
      expect(result).toEqual({ displayUrl: source });
      if (failure !== "upload") expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("tries a carousel image when the primary image fails", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("expired"))
      .mockResolvedValueOnce(media(jpeg))
      .mockResolvedValueOnce({ ok: true });
    expect(
      await retainInstagramThumbnail(
        { displayUrl: source, images: ["https://b.fbcdn.net/cover.jpg"] },
        artist,
        "2",
      ),
    ).toHaveProperty("_musicnerdThumbnail.sourceUrl", "https://b.fbcdn.net/cover.jpg");
  });

  it("isolates identical thumbnails by job", async () => {
    const first = {
      jobId: "11111111-1111-4111-8111-111111111111",
      attemptedPaths: new Set<string>(),
    };
    const second = {
      jobId: "22222222-2222-4222-8222-222222222222",
      attemptedPaths: new Set<string>(),
    };
    fetchMock
      .mockResolvedValueOnce(media(jpeg))
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce(media(jpeg))
      .mockResolvedValueOnce({ ok: true });
    await retainInstagramThumbnail({ displayUrl: source }, artist, "123", first);
    await retainInstagramThumbnail({ displayUrl: source }, artist, "123", second);
    expect([...first.attemptedPaths][0]).not.toEqual([...second.attemptedPaths][0]);
  });

  it("tracks attempted uploads even when their response fails", async () => {
    const scope = {
      jobId: "11111111-1111-4111-8111-111111111111",
      attemptedPaths: new Set<string>(),
    };
    fetchMock
      .mockResolvedValueOnce(media(jpeg))
      .mockRejectedValueOnce(new Error("Connection lost"));
    expect(await retainInstagramThumbnail({ displayUrl: source }, artist, "123", scope)).toEqual({
      displayUrl: source,
    });
    expect(scope.attemptedPaths.size).toBe(1);
  });

  it("returns the post untouched when storage is not configured", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(await retainInstagramThumbnail({ displayUrl: source }, artist, "1")).toEqual({
      displayUrl: source,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
