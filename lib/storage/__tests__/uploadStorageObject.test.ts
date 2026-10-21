import { describe, it, expect, vi, beforeEach } from "vitest";

const { storageFetch } = vi.hoisted(() => ({ storageFetch: vi.fn() }));
vi.mock("@/lib/storage/storageFetch", () => ({ storageFetch }));
const { uploadStorageObject } = await import("@/lib/storage/uploadStorageObject");

beforeEach(() => {
  storageFetch.mockReset();
});

describe("uploadStorageObject", () => {
  it("uploads bytes with the content type, upsert flag and cache control", async () => {
    storageFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const body = Buffer.from("webp");
    await uploadStorageObject("user-profile-images", "u1/avatar.webp", body, {
      contentType: "image/webp",
      upsert: true,
      cacheControl: "0",
    });
    expect(storageFetch).toHaveBeenCalledTimes(1);
    const [path, init] = storageFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("object/user-profile-images/u1/avatar.webp");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "Content-Type": "image/webp",
      "Cache-Control": "max-age=0",
      "x-upsert": "true",
    });
    expect(init.body).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(init.body as Uint8Array).toString()).toBe("webp");
  });

  it("throws on a Storage error", async () => {
    storageFetch.mockResolvedValueOnce(new Response("{}", { status: 400 }));
    await expect(
      uploadStorageObject("b", "p", Buffer.from(""), {
        contentType: "image/webp",
        upsert: false,
        cacheControl: "3600",
      }),
    ).rejects.toThrow("Storage upload failed: HTTP 400");
  });
});
