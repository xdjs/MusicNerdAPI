import { describe, it, expect } from "vitest";
import { getUploadSourceType } from "@/lib/vaultUpload/getUploadSourceType";

describe("getUploadSourceType", () => {
  it("classifies by MIME family, with CSV and JSON as data", () => {
    expect(getUploadSourceType("image/png")).toBe("image");
    expect(getUploadSourceType("audio/wav")).toBe("audio");
    expect(getUploadSourceType("text/csv")).toBe("data");
    expect(getUploadSourceType("application/json")).toBe("data");
    expect(getUploadSourceType("application/pdf")).toBe("document");
    expect(getUploadSourceType("text/plain")).toBe("document");
  });
});
