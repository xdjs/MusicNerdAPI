import { describe, it, expect } from "vitest";
import { truncateUrlForDisplay } from "@/lib/onboarding/truncateUrlForDisplay";

describe("truncateUrlForDisplay", () => {
  it("keeps a short URL and cuts a long one to 48 characters with an ellipsis", () => {
    expect(truncateUrlForDisplay("https://a.com/x")).toBe("https://a.com/x");
    const long = `https://example.com/${"a".repeat(60)}`;
    const cut = truncateUrlForDisplay(long);
    expect(cut).toHaveLength(48);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut.startsWith("https://example.com/aaa")).toBe(true);
  });
});
