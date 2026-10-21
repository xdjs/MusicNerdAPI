/**
 * Checks that an image's binary header matches its declared type: a client can
 * declare `image/png` on a non-PNG payload, and the stored URL is served
 * publicly. True when it matches, or when the type has no signature here;
 * false when the header contradicts the declared type.
 *
 * @param buffer - The file's bytes.
 * @param mimeType - The declared MIME type.
 * @returns Whether the bytes may be that type.
 */
export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const headerBytes = Array.from(new Uint8Array(buffer.subarray(0, 12)));

  // Simple prefix signatures
  const magicSignatures: Record<string, number[]> = {
    "image/png": [0x89, 0x50, 0x4e, 0x47], // .PNG
    "image/jpeg": [0xff, 0xd8, 0xff], // JFIF
  };
  const expected = magicSignatures[mimeType];
  if (expected) return expected.every((b, i) => headerBytes[i] === b);

  // RIFF-based: bytes 0-3 are RIFF, bytes 8-11 the subtype
  if (mimeType === "image/webp") {
    const isRiff = [0x52, 0x49, 0x46, 0x46].every((b, i) => headerBytes[i] === b);
    const subtypeBytes = headerBytes.slice(8, 12);
    return isRiff && [0x57, 0x45, 0x42, 0x50].every((b, i) => subtypeBytes[i] === b);
  }

  // Sanitize and truncate to prevent log injection from user-supplied MIME types
  const sanitized = mimeType.replace(/[^\x20-\x7E]/g, "").slice(0, 100);
  console.warn(`[validateMagicBytes] No signature check for "${sanitized}", passing through`);
  return true;
}
