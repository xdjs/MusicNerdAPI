import { describe, expect, it, vi } from "vitest";
import type { WriteDb } from "@/lib/db/db";
import { socialTaskIsConnected } from "@/lib/social/socialTaskIsConnected";
describe("current social identity", () => {
  it("requires the same current handle before a provider run or write", async () => {
    const writer = {
      execute: vi.fn().mockResolvedValue([{ x: "https://x.com/NewArtist" }]),
    } as unknown as WriteDb;
    expect(await socialTaskIsConnected("a", { source: "x", handle: "oldartist" }, writer)).toBe(
      false,
    );
    expect(await socialTaskIsConnected("a", { source: "x", handle: "newartist" }, writer)).toBe(
      true,
    );
  });
  it("distinguishes missing data from a disconnected profile", async () => {
    const writer = { execute: vi.fn().mockResolvedValue([]) } as unknown as WriteDb;
    await expect(
      socialTaskIsConnected("a", { source: "x", handle: "artist" }, writer),
    ).rejects.toThrow("could not read current social identity");
  });
});
