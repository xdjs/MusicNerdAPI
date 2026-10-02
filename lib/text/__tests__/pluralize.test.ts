import { describe, it, expect } from "vitest";
import { pluralize } from "@/lib/text/pluralize";

describe("pluralize", () => {
  it("picks the singular for one and the plural otherwise", () => {
    expect(pluralize(1, "source", "sources")).toBe("source");
    expect(pluralize(0, "source", "sources")).toBe("sources");
    expect(pluralize(2, "it", "them")).toBe("them");
  });
});
