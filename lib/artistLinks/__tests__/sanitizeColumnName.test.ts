import { describe, it, expect } from "vitest";
import { sanitizeColumnName } from "@/lib/artistLinks/sanitizeColumnName";

describe("sanitizeColumnName", () => {
  it("strips everything but letters, digits and underscores", () => {
    expect(sanitizeColumnName("insta-gram; drop")).toBe("instagramdrop");
    expect(sanitizeColumnName("facebookID")).toBe("facebookID");
  });
});
