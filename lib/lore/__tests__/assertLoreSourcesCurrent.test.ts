import { expect, it, vi } from "vitest";
import { assertLoreSourcesCurrent } from "../assertLoreSourcesCurrent";
import { vaultSourceRevision } from "../vaultSourceRevision";
const source = {
  url: "https://example.org/a",
  extractedText: "Original text. ".repeat(40),
  status: "approved",
  filePath: null,
};
const manifest = [
  {
    id: 1,
    kind: "vault" as const,
    url: source.url,
    label: "A",
    revision: vaultSourceRevision(source),
  },
];
it("accepts exactly the same eligible source revisions", async () => {
  const tx = { execute: vi.fn().mockResolvedValue([source]) };
  await expect(assertLoreSourcesCurrent(tx as never, "a", manifest)).resolves.toBeUndefined();
});
it.each(["reject", "replace", "add", "legacy"])("rejects a %s source race", async change => {
  const rows =
    change === "reject"
      ? []
      : change === "replace"
        ? [{ ...source, extractedText: "Changed text. ".repeat(40) }]
        : change === "add"
          ? [source, { ...source, url: "https://example.org/b" }]
          : [source];
  const tx = { execute: vi.fn().mockResolvedValue(rows) };
  await expect(
    assertLoreSourcesCurrent(
      tx as never,
      "a",
      change === "legacy" ? manifest.map(s => ({ ...s, revision: undefined })) : manifest,
    ),
  ).rejects.toThrow("Lore sources changed");
});
it("fails closed on a read error", async () => {
  const tx = { execute: vi.fn().mockRejectedValue(new Error("offline")) };
  await expect(assertLoreSourcesCurrent(tx as never, "a", manifest)).rejects.toThrow("offline");
});
