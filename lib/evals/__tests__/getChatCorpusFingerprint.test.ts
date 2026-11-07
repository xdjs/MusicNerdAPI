import { expect, it } from "vitest";
import { getChatCorpusFingerprint } from "@/lib/chat/getChatCorpusFingerprint";

it("ignores object insertion order but preserves row order and all source fields", () => {
  const one = { sourceId: "one", revision: "r1", text: "Exact 😀 text", title: "Public" };
  expect(getChatCorpusFingerprint([one])).toBe(
    getChatCorpusFingerprint([
      { title: one.title, text: one.text, revision: one.revision, sourceId: one.sourceId },
    ]),
  );
  for (const field of ["revision", "text", "title", "sourceId"])
    expect(getChatCorpusFingerprint([{ ...one, [field]: "changed" }])).not.toBe(
      getChatCorpusFingerprint([one]),
    );
  expect(getChatCorpusFingerprint([one, { sourceId: "two" }])).not.toBe(
    getChatCorpusFingerprint([{ sourceId: "two" }, one]),
  );
  expect(getChatCorpusFingerprint([one])).toMatch(/^[a-f0-9]{64}$/);
});
