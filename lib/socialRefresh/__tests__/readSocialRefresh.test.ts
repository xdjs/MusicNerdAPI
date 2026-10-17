import { expect, it, vi } from "vitest";
import { readSocialRefresh } from "../readSocialRefresh";
import type { WriteDb } from "@/lib/db/db";
vi.mock("@/lib/db/db", () => ({ db: {} }));

it("starts Instagram Latest without a cutoff when no checkpoint exists", async () => {
  const reader = { execute: vi.fn().mockResolvedValue([]) } as unknown as WriteDb;
  expect(await readSocialRefresh("a", "instagram", "June", 30, reader)).toMatchObject({
    scope: "latest",
  });
  expect((await readSocialRefresh("a", "instagram", "June", 30, reader)).after).toBeUndefined();
  expect((await readSocialRefresh("a", "tiktok", "June", 30, reader)).after).toBeDefined();
});
