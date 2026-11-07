import { expect, it } from "vitest";
import { CHAT_CASES } from "@/lib/evals/chatCases";

it("keeps the existing paid-case count while correcting the album reference", () => {
  expect(CHAT_CASES).toHaveLength(11);
  const album = CHAT_CASES.find(c => c.key === "willie-colon-blades")!;
  expect(album.reference).toContain("Glide");
  expect(album.reference).toContain("Rolling Stone");
  expect(album.reference).toContain("1975 section");
  expect(album.reference).toContain("without a forced unique winner");
});

it("keeps primary-alias scope without requiring unasked dates", () => {
  const aliases = CHAT_CASES.find(c => c.key === "dutchyyy-aliases")!;
  expect(aliases.reference).toContain("Dutchmassive");
  expect(aliases.reference).toContain("Dutchy");
  expect(aliases.reference).toContain("Role or current-name context is optional");
  expect(aliases.reference).toContain("primary alias");
  expect(aliases.reference).toContain("If dates are given");
  expect(aliases.reference).toContain("not first-ever use");
});

it("includes the explicitly credited alias without forcing uncertain nicknames or a complete use span", () => {
  const aliases = CHAT_CASES.find(c => c.key === "dutchyyy-aliases")!;
  expect(CHAT_CASES).toHaveLength(11);
  expect(aliases.question).toBe("What other names has Dutchyyy released music under?");
  expect(aliases.reference).toContain("The Chill Factor");
  expect(aliases.reference).toContain("source-attributed credited alias");
  expect(aliases.reference).toContain("full use span unknown");
  expect(aliases.reference).toContain("The Hobbyshop Hero");
  expect(aliases.reference).toContain("not a required established alias");
  expect(aliases.reference).toContain("not an exhaustive historical alias list");
});
