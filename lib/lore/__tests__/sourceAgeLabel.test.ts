import { describe, it, expect } from "vitest";
import { sourceAgeLabel } from "@/lib/lore/sourceAgeLabel";

const now = new Date("2026-09-29T00:00:00Z");

describe("sourceAgeLabel", () => {
  it("says a source is undated rather than leaving it unmarked", () => {
    expect(sourceAgeLabel(null, now)).toBe("date unknown");
    expect(sourceAgeLabel("not a date", now)).toBe("date unknown");
  });

  it("gives the date and its age in years", () => {
    expect(sourceAgeLabel("2019-01-10", now)).toBe("published 2019-01-10, 8 years ago");
    expect(sourceAgeLabel("2025-06-01", now)).toBe("published 2025-06-01, 1 year ago");
  });

  it("calls a recent source recent and a future date just a date", () => {
    expect(sourceAgeLabel("2026-05-01", now)).toBe("published 2026-05-01, within the last year");
    expect(sourceAgeLabel("2027-01-01", now)).toBe("published 2027-01-01");
  });
});
