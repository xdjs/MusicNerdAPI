// Text-based formats with no reliable magic bytes; skipped.
const KNOWN_TEXT_TYPES = new Set(["text/plain", "text/markdown", "text/csv", "application/json"]);

/**
 * Whether a file's binary header matches its declared MIME type, so a renamed
 * executable can't pass as a PDF. True when it matches, or when there is no
 * signature check for the type; false when the header contradicts the type.
 *
 * @param buffer - The file's bytes.
 * @param mimeType - The declared type.
 * @returns True unless the header contradicts the type.
 */
export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const headerBytes = Array.from(new Uint8Array(buffer.subarray(0, 12)));

  // Simple prefix signatures
  const magicSignatures: Record<string, number[]> = {
    "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
    "image/png": [0x89, 0x50, 0x4e, 0x47], // .PNG
    "image/jpeg": [0xff, 0xd8, 0xff], // JFIF
    "application/msword": [0xd0, 0xcf, 0x11, 0xe0], // OLE2 (.doc)
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
      0x50, 0x4b, 0x03, 0x04,
    ], // ZIP/OOXML (.docx)
  };

  const expected = magicSignatures[mimeType];
  if (expected) {
    return expected.every((b, i) => headerBytes[i] === b);
  }

  // RIFF-based formats: bytes 0-3 are RIFF, bytes 8-11 the subtype
  const riffSubtypes: Record<string, number[]> = {
    "image/webp": [0x57, 0x45, 0x42, 0x50], // WEBP
    "audio/wav": [0x57, 0x41, 0x56, 0x45], // WAVE
  };

  const riffSubtype = riffSubtypes[mimeType];
  if (riffSubtype) {
    const isRiff = [0x52, 0x49, 0x46, 0x46].every((b, i) => headerBytes[i] === b);
    const subtypeBytes = headerBytes.slice(8, 12);
    return isRiff && riffSubtype.every((b, i) => subtypeBytes[i] === b);
  }

  // MP3: ID3v2 tag or raw sync word
  if (mimeType === "audio/mpeg") {
    const mp3Signatures = [
      [0x49, 0x44, 0x33],
      [0xff, 0xfb],
      [0xff, 0xfa],
      [0xff, 0xf3],
      [0xff, 0xf2],
    ];
    return mp3Signatures.some(sig => sig.every((b, i) => headerBytes[i] === b));
  }

  if (!KNOWN_TEXT_TYPES.has(mimeType)) {
    // A new binary type in VAULT_UPLOAD_TYPES needs its signature here too,
    // or its check is silently skipped. The type is sanitized and truncated
    // because it comes from the client.
    const sanitized = mimeType.replace(/[^\x20-\x7E]/g, "").slice(0, 100);
    console.warn(`[validateMagicBytes] No signature check for "${sanitized}", passing through`);
  }
  return true;
}
