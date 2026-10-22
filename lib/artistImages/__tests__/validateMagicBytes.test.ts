import { describe, it, expect, vi, afterEach } from "vitest";
import { validateMagicBytes } from "@/lib/artistImages/validateMagicBytes";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const WAV = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("validateMagicBytes", () => {
  it("accepts a PNG, JPEG and WebP whose bytes match the declared type", () => {
    expect(validateMagicBytes(PNG, "image/png")).toBe(true);
    expect(validateMagicBytes(JPEG, "image/jpeg")).toBe(true);
    expect(validateMagicBytes(WEBP, "image/webp")).toBe(true);
  });

  it("rejects bytes that contradict the declared type", () => {
    expect(validateMagicBytes(JPEG, "image/png")).toBe(false);
    expect(validateMagicBytes(PNG, "image/jpeg")).toBe(false);
    expect(validateMagicBytes(WAV, "image/webp")).toBe(false);
    expect(validateMagicBytes(PNG, "image/webp")).toBe(false);
    expect(validateMagicBytes(Buffer.alloc(0), "image/png")).toBe(false);
  });

  it("passes a type with no signature through, with a sanitized warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(validateMagicBytes(PNG, "image/gif\n[fake]")).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"image/gif[fake]"'));
  });
});
