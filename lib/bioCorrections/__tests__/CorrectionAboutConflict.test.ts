import { describe, it, expect } from "vitest";
import { CorrectionAboutConflict } from "@/lib/bioCorrections/CorrectionAboutConflict";

describe("CorrectionAboutConflict", () => {
  it("is an Error carrying the admin-facing message", () => {
    const error = new CorrectionAboutConflict("This About is pinned.");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("CorrectionAboutConflict");
    expect(error.message).toBe("This About is pinned.");
  });
});
