import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { nextBioProvenance } from "../nextBioProvenance";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const sources = [
  {
    id: 1,
    kind: "vault",
    label: "Evidence",
    url: "https://example.org/a",
    revision: "a".repeat(64),
  },
];
it("records exact generated evidence separately from mutable Lore", () => {
  const p = nextBioProvenance("New", "Old", null, { generated: true, claimId: "claim", sources });
  expect(p).toEqual({
    version: 1,
    kind: "generated",
    bioHash: hash("New"),
    claimId: "claim",
    sources,
  });
  sources[0].label = "Changed";
  expect((p as { sources: typeof sources }).sources[0].label).toBe("Evidence");
  sources[0].label = "Evidence";
});
it("marks generation without a source snapshot unknown instead of legacy/manual", () => {
  expect(nextBioProvenance("New", null, null, { generated: true, claimId: null })).toEqual({
    version: 1,
    kind: "unknown",
    bioHash: hash("New"),
  });
});
it("keeps legacy/manual behavior without fabricating evidence", () => {
  expect(nextBioProvenance("Edit", "Old", null)).toBeNull();
});
it("manual edits and same-text saves cannot erase generated lineage", () => {
  const p = nextBioProvenance("New", null, null, { generated: true, claimId: "claim", sources });
  expect(nextBioProvenance("New", "New", p)).toEqual(p);
  expect(nextBioProvenance("Edited", "New", p)).toEqual({
    ...(p as object),
    bioHash: hash("Edited"),
  });
});
it("malformed or text-mismatched previous lineage stays fail closed after editing", () => {
  for (const p of [
    {},
    { version: 1, kind: "generated", bioHash: hash("different"), sources, claimId: "claim" },
  ])
    expect(nextBioProvenance("Edit", "Old", p)).toEqual({
      version: 1,
      kind: "unknown",
      bioHash: hash("Edit"),
    });
});
it("same-text regeneration can replace the evidence snapshot", () => {
  const p = nextBioProvenance("New", null, null, { generated: true, claimId: "old", sources });
  expect(
    nextBioProvenance("New", "New", p, { generated: true, claimId: "new", sources }),
  ).toMatchObject({ claimId: "new" });
});
