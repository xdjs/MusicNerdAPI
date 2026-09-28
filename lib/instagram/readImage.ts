import { THUMBNAIL_MAX_BYTES } from "@/lib/instagram/const";

/**
 * Reads a media response into memory, refusing anything that is not a JPEG,
 * PNG or WebP, or that is larger than the cap, whether declared or streamed.
 *
 * @param response - The media host's response.
 * @returns The image bytes; throws on a bad type or size.
 */
export async function readImage(response: Response): Promise<Buffer> {
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !/^image\/(jpeg|png|webp)(?:;|$)/i.test(type)) {
    throw new Error("Invalid media response");
  }
  if (Number(response.headers.get("content-length")) > THUMBNAIL_MAX_BYTES || !response.body) {
    throw new Error("Image too large or empty");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > THUMBNAIL_MAX_BYTES) throw new Error("Image too large");
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    await reader.cancel();
  }
}
