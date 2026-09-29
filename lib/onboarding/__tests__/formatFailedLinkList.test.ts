import { describe, it, expect } from "vitest";
import { formatFailedLinkList } from "@/lib/onboarding/formatFailedLinkList";

describe("formatFailedLinkList", () => {
  it("joins the links, each truncated for display", () => {
    const long = `https://example.com/${"a".repeat(60)}`;
    expect(formatFailedLinkList(["https://a.com", long])).toBe(
      `https://a.com, ${long.slice(0, 47)}…`,
    );
  });
});
