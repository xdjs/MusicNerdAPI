import { describe, it, expect } from "vitest";
import { resolveUploadType } from "@/lib/vaultUpload/resolveUploadType";
import { VAULT_UPLOAD_TYPES } from "@/lib/vaultUpload/const";

describe("resolveUploadType", () => {
  it("prefers the declared type when it is allowed", () => {
    expect(resolveUploadType("x.bin", "application/pdf", VAULT_UPLOAD_TYPES)).toBe(
      "application/pdf",
    );
    expect(resolveUploadType("x.pdf", " Image/PNG ", VAULT_UPLOAD_TYPES)).toBe("image/png");
  });

  it("falls back to the extension for an empty or nonstandard declared type", () => {
    expect(resolveUploadType("notes.md", "", VAULT_UPLOAD_TYPES)).toBe("text/markdown");
    expect(resolveUploadType("notes.MARKDOWN", "", VAULT_UPLOAD_TYPES)).toBe("text/markdown");
    expect(resolveUploadType("data.csv", "application/octet-stream", VAULT_UPLOAD_TYPES)).toBe(
      "text/csv",
    );
    expect(resolveUploadType("photo.JPG", "", VAULT_UPLOAD_TYPES)).toBe("image/jpeg");
  });

  it("is null when neither the declared type nor the extension is allowed", () => {
    expect(resolveUploadType("archive.zip", "application/zip", VAULT_UPLOAD_TYPES)).toBeNull();
    expect(resolveUploadType("noext", "", VAULT_UPLOAD_TYPES)).toBeNull();
    expect(resolveUploadType("x.pdf", "application/pdf", ["image/png"])).toBeNull();
  });
});
