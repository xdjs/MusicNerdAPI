import { describe, it, expect } from "vitest";
import { validateMagicBytes } from "@/lib/vaultUpload/validateMagicBytes";

const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("validateMagicBytes", () => {
  it("accepts a header that matches the declared type", () => {
    expect(validateMagicBytes(Buffer.from("%PDF-1.4\nfixture"), "application/pdf")).toBe(true);
    expect(validateMagicBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), "image/png")).toBe(
      true,
    );
    expect(validateMagicBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")).toBe(true);
    expect(validateMagicBytes(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), "application/msword")).toBe(
      true,
    );
    expect(validateMagicBytes(Buffer.from([0x50, 0x4b, 0x03, 0x04]), docx)).toBe(true);
  });

  it("rejects a PDF declared but not present: the bad magic byte", () => {
    expect(validateMagicBytes(Buffer.from("x".repeat(16)), "application/pdf")).toBe(false);
    expect(validateMagicBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47]), "application/pdf")).toBe(
      false,
    );
    expect(validateMagicBytes(Buffer.alloc(0), "image/png")).toBe(false);
  });

  it("checks RIFF subtypes for WebP and WAV", () => {
    const riff = (subtype: string) =>
      Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from(subtype)]);
    expect(validateMagicBytes(riff("WEBP"), "image/webp")).toBe(true);
    expect(validateMagicBytes(riff("WAVE"), "audio/wav")).toBe(true);
    expect(validateMagicBytes(riff("WAVE"), "image/webp")).toBe(false);
    expect(validateMagicBytes(Buffer.from("WEBPWEBPWEBP"), "image/webp")).toBe(false);
  });

  it("accepts an MP3 with an ID3 tag or a raw sync word", () => {
    expect(validateMagicBytes(Buffer.from("ID3\x04"), "audio/mpeg")).toBe(true);
    expect(validateMagicBytes(Buffer.from([0xff, 0xfb, 0x90]), "audio/mpeg")).toBe(true);
    expect(validateMagicBytes(Buffer.from("RIFF"), "audio/mpeg")).toBe(false);
  });

  it("passes text types and unknown types through", () => {
    expect(validateMagicBytes(Buffer.from("# notes"), "text/markdown")).toBe(true);
    expect(validateMagicBytes(Buffer.from("a,b"), "text/csv")).toBe(true);
    expect(validateMagicBytes(Buffer.from("{}"), "application/json")).toBe(true);
    expect(validateMagicBytes(Buffer.from("?"), "application/x-unknown")).toBe(true);
  });
});
