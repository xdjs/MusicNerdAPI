import { describe, it, expect } from "vitest";
import { formatFileSize } from "@/lib/vaultUpload/formatFileSize";

describe("formatFileSize", () => {
  it("formats bytes, kilobytes and megabytes as MusicNerdWeb does", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(10 * 1024 * 1024 + 1)).toBe("10.0 MB");
    expect(formatFileSize(13 * 1024 * 1024)).toBe("13.0 MB");
  });
});
