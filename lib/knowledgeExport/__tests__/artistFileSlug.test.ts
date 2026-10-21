import { it, expect } from "vitest";
import { artistFileSlug } from "@/lib/knowledgeExport/artistFileSlug";

it("makes a lowercase hyphenated file name, falling back to artist", () => {
  expect(artistFileSlug("Bio Ritmo!")).toBe("bio-ritmo");
  expect(artistFileSlug("  --Beyoncé--  ")).toBe("beyonc");
  expect(artistFileSlug("東京")).toBe("artist");
});
