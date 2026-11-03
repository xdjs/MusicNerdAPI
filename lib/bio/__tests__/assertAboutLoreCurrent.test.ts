import { expect, it, vi } from "vitest";
const check = vi.hoisted(() => vi.fn());
vi.mock("@/lib/lore/assertLoreSourcesCurrent", () => ({ assertLoreSourcesCurrent: check }));
const { assertAboutLoreCurrent } = await import("../assertAboutLoreCurrent");
const doc = {
  content: "Lore",
  sources: [{ id: 1, kind: "interview" as const, url: null, label: "Interview" }],
};
it("refuses a replaced document before publication", async () => {
  const tx = { execute: vi.fn().mockResolvedValue([{ ...doc, content: "Replacement" }]) };
  await expect(assertAboutLoreCurrent(tx as never, "a", doc)).rejects.toThrow(
    "Lore sources changed",
  );
});
it("rechecks evidence even when document text still matches", async () => {
  const tx = { execute: vi.fn().mockResolvedValue([doc]) };
  check.mockRejectedValueOnce(new Error("removed source"));
  await expect(assertAboutLoreCurrent(tx as never, "a", doc)).rejects.toThrow("removed source");
  expect(check).toHaveBeenCalledWith(tx, "a", doc.sources);
});
