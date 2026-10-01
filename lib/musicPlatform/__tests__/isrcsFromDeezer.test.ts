import { describe, it, expect, vi, beforeEach } from "vitest";

const { fetchJson } = vi.hoisted(() => ({ fetchJson: vi.fn() }));
vi.mock("@/lib/networking/fetchJson", () => ({ fetchJson }));
const { isrcsFromDeezer } = await import("@/lib/musicPlatform/isrcsFromDeezer");

beforeEach(() => {
  fetchJson.mockReset();
});

describe("isrcsFromDeezer", () => {
  it("reads up to five top tracks and returns their distinct ISRCs", async () => {
    fetchJson.mockImplementation(async (url: string) => {
      if (url.includes("/top?")) return { data: [{ id: 1 }, { id: 2 }, { id: 3 }] };
      if (url.endsWith("/track/1")) return { isrc: "AAA" };
      if (url.endsWith("/track/2")) return { isrc: "AAA" };
      return {};
    });
    expect(await isrcsFromDeezer("94933462")).toEqual(["AAA"]);
    expect(fetchJson).toHaveBeenCalledWith("https://api.deezer.com/artist/94933462/top?limit=5", {
      timeoutMs: 4000,
    });
  });

  it("is empty when Deezer answers nothing", async () => {
    fetchJson.mockResolvedValue(null);
    expect(await isrcsFromDeezer("1")).toEqual([]);
  });
});
