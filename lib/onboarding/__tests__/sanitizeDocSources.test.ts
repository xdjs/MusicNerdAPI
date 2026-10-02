import { describe, it, expect } from "vitest";
import { sanitizeDocSources } from "@/lib/onboarding/sanitizeDocSources";

describe("sanitizeDocSources", () => {
  it("keeps well-formed entries and drops anything malformed", () => {
    expect(
      sanitizeDocSources([
        { id: 1, kind: "vault", label: "Real one", url: "https://x.com", extra: "dropped" },
        { id: 2, kind: "interview", label: "Their words", url: null },
        { id: "not-a-number", kind: "vault", label: "bad id", url: null },
        { id: 3, kind: "nonsense", label: "bad kind", url: null },
        { id: 4, kind: "social", label: 4, url: null },
        { id: 5, kind: "social", label: "bad url", url: 5 },
        "not even an object",
        null,
      ]),
    ).toEqual([
      { id: 1, kind: "vault", label: "Real one", url: "https://x.com" },
      { id: 2, kind: "interview", label: "Their words", url: null },
    ]);
  });

  it("is empty for a non-array, and caps the list at 200", () => {
    expect(sanitizeDocSources(undefined)).toEqual([]);
    expect(sanitizeDocSources({ id: 1 })).toEqual([]);
    const many = Array.from({ length: 250 }, (_, i) => ({
      id: i,
      kind: "vault",
      label: "l",
      url: null,
    }));
    expect(sanitizeDocSources(many)).toHaveLength(200);
  });
});
