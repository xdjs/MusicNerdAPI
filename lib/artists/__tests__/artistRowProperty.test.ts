import { describe, it, expect } from "vitest";
import { artistRowProperty } from "@/lib/artists/artistRowProperty";

describe("artistRowProperty", () => {
  it("translates the two columns whose row property differs", () => {
    expect(artistRowProperty("facebookID")).toBe("facebookId");
    expect(artistRowProperty("tiktokID")).toBe("tiktokId");
  });

  it("is the column itself otherwise", () => {
    expect(artistRowProperty("instagram")).toBe("instagram");
  });
});
