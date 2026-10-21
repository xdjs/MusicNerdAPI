import { it, expect, vi, beforeEach } from "vitest";

const findFirst = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/db", () => ({ db: { query: { artistBioVersions: { findFirst } } } }));
const { hasPinnedBio } = await import("@/lib/bio/hasPinnedBio");

beforeEach(() => findFirst.mockReset());

it("is true when a version is pinned", async () => {
  findFirst.mockResolvedValue({ id: "v1" });
  expect(await hasPinnedBio("a1")).toBe(true);
  findFirst.mockResolvedValue(undefined);
  expect(await hasPinnedBio("a1")).toBe(false);
});

it("treats a failed read as not pinned; the locked write re-checks the pin", async () => {
  findFirst.mockRejectedValueOnce(new Error("offline"));
  expect(await hasPinnedBio("a1")).toBe(false);
});
