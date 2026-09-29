import { describe, it, expect } from "vitest";
import { foldName } from "@/lib/text/foldName";

describe("foldName", () => {
  it("folds case, diacritics, spacing and punctuation away", () => {
    expect(foldName("Sigur Rós")).toBe("sigurros");
    expect(foldName("@Pharaoh.Sistare")).toBe("pharaohsistare");
  });

  it("keeps styled-unicode capitals (NFKD before lowercase)", () => {
    expect(foldName("𝐁𝐋𝐀𝐂𝐊𝐃𝐀𝐕𝐄 𝐌𝐊𝟐")).toBe("blackdavemk2");
  });
});
