import { expect, it } from "vitest";
import { normalizeKnowledgeSourceSnapshot } from "@/lib/knowledge/normalizeKnowledgeSourceSnapshot";
import { artistId, social, vault } from "./fixtures";

it("preserves the released v1 citation hashes when decoding database snapshots", () => {
  // Frozen from the released normalization contract, not computed by the implementation under test.
  expect(
    normalizeKnowledgeSourceSnapshot({ version: 1, kind: "vault", ...vault }, artistId)[0].metadata
      .revision,
  ).toBe("789c3f689a69a6af4fdecc8b2b7d7dc725d44ede1987dd6764887f48b3764ce8");
  expect(
    normalizeKnowledgeSourceSnapshot({ version: 1, kind: "social", ...social }, artistId).map(
      s => s.metadata.revision,
    ),
  ).toEqual([
    "5bae9320dc46840a4472cc505aab0a4b0a4f7d725fafd24097108bc1f4e4ed62",
    "b729014e930487f95ac58910ca975023ffc23a50bc02a7bf2f1f913748671194",
  ]);
});

it("does not move historical evidence to a different artist or accept an unknown snapshot format", () => {
  expect(
    normalizeKnowledgeSourceSnapshot({ version: 1, kind: "vault", ...vault }, social.id),
  ).toEqual([]);
  expect(() =>
    normalizeKnowledgeSourceSnapshot({ version: 2, kind: "vault", ...vault }, artistId),
  ).toThrow();
});
