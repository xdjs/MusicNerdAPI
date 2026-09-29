import { describe, it, expect } from "vitest";
import { getArtistLinkValue } from "@/lib/artistLinks/getArtistLinkValue";

describe("getArtistLinkValue", () => {
  it("reads a column through its row property", () => {
    expect(getArtistLinkValue({ instagram: "pete" }, "instagram")).toBe("pete");
    expect(getArtistLinkValue({ facebookId: "123" }, "facebookID")).toBe("123");
    expect(getArtistLinkValue({ tiktokId: "9" }, "tiktokID")).toBe("9");
  });

  it("is null when unset", () => {
    expect(getArtistLinkValue({}, "x")).toBeNull();
  });
});
