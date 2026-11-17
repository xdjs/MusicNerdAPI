import { expect, it, vi } from "vitest";
import { listSearchCandidates } from "@/lib/evals/listSearchCandidates";
import type { UnitHit } from "@/lib/units/types";

const hit = (sourceId: string, locator: string, sourceKind: UnitHit["sourceKind"] = "vault") =>
  ({ sourceKind, sourceId, locator }) as UnitHit;

it("lists text candidates in both rankings per expanded query, then the vector list, as text-free keys", async () => {
  const byText = vi.fn(async (_artist: string, query: string, _limit?: number, mode?: string) => [
    hit(`${mode === "idf" ? "bbbbbbbb" : "aaaaaaaa"}-0000-4000-8000-000000000001`, "p.2"),
    ...(query.endsWith("Artist")
      ? [hit("cccccccc-0000-4000-8000-000000000001", "¶1", "social")]
      : []),
  ]);
  const byVector = vi.fn(async () => [hit("dddddddd-0000-4000-8000-000000000001", "§Intro")]);
  const embed = vi.fn(async () => [0.1]);
  const lists = await listSearchCandidates("artist", "Where were they born?", ["Artist"], 60, {
    byText: byText as never,
    byVector: byVector as never,
    embed: embed as never,
  });
  expect(lists).toEqual([
    { name: "or#0", units: ["vault:aaaaaaaa:p.2"] },
    { name: "idf#0", units: ["vault:bbbbbbbb:p.2"] },
    { name: "or#1", units: ["vault:aaaaaaaa:p.2", "social:cccccccc:¶1"] },
    { name: "idf#1", units: ["vault:bbbbbbbb:p.2", "social:cccccccc:¶1"] },
    { name: "vector", units: ["vault:dddddddd:§Intro"] },
  ]);
  expect(byText).toHaveBeenCalledWith("artist", "Where were they born?", 60, "or");
  expect(embed).toHaveBeenCalledWith("Where were they born?");
});

it("does not expand a question that already names the artist", async () => {
  const lists = await listSearchCandidates("artist", "Where was Artist born?", ["Artist"], 5, {
    byText: (async () => []) as never,
    byVector: (async () => []) as never,
    embed: (async () => [0.1]) as never,
  });
  expect(lists.map(l => l.name)).toEqual(["or#0", "idf#0", "vector"]);
});
