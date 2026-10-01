import { describe, it, expect } from "vitest";
import { artistHasRawLinkValue } from "@/lib/links/artistHasRawLinkValue";

describe("artistHasRawLinkValue", () => {
  it("is true only for a non-empty string in that column", () => {
    expect(artistHasRawLinkValue({ instagram: "pete" }, "instagram")).toBe(true);
    expect(artistHasRawLinkValue({ instagram: "" }, "instagram")).toBe(false);
    expect(artistHasRawLinkValue({ instagram: null }, "instagram")).toBe(false);
    expect(artistHasRawLinkValue({}, "x")).toBe(false);
  });

  it("reads remapped columns by their row property", () => {
    expect(artistHasRawLinkValue({ facebookId: "123" }, "facebookID")).toBe(true);
  });
});
