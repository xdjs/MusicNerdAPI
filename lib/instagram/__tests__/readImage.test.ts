import { describe, it, expect } from "vitest";
import { readImage } from "@/lib/instagram/readImage";
import { media } from "./media";

describe("readImage", () => {
  it("reads an image body into a buffer", async () => {
    const bytes = Buffer.from([1, 2, 3]);
    expect(await readImage(media(bytes) as unknown as Response)).toEqual(bytes);
  });

  it("rejects a non-image content type", async () => {
    await expect(
      readImage(media(Buffer.from("x"), "image/svg+xml") as unknown as Response),
    ).rejects.toThrow("Invalid media response");
  });

  it("rejects an oversized image, declared or streamed", async () => {
    const big = String(9 * 1024 * 1024);
    await expect(
      readImage(media(Buffer.from("x"), "image/jpeg", big) as unknown as Response),
    ).rejects.toThrow("too large");
    await expect(
      readImage(media(Buffer.alloc(9 * 1024 * 1024)) as unknown as Response),
    ).rejects.toThrow("Image too large");
  });
});
