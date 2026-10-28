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

it("strict matching rejects unavailable, mismatched and uncredited recordings", async () => {
  fetchJson.mockResolvedValueOnce(null);
  await expect(isrcsFromDeezer("42", true)).rejects.toThrow();
  fetchJson
    .mockResolvedValueOnce({ data: [{ id: 1 }] })
    .mockResolvedValueOnce({ id: 2, isrc: "USAAA0000001" });
  await expect(isrcsFromDeezer("42", true)).rejects.toThrow();
  fetchJson
    .mockResolvedValueOnce({ data: [{ id: 1 }] })
    .mockResolvedValueOnce({ id: 1, isrc: "USAAA0000001", artist: { id: 99 } });
  await expect(isrcsFromDeezer("42", true)).rejects.toThrow();
});

it("strict matching includes a featured source artist and deduplicates valid ISRCs", async () => {
  fetchJson
    .mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }] })
    .mockResolvedValueOnce({
      id: 1,
      isrc: "usaaa0000001",
      artist: { id: 99 },
      contributors: [{ id: 42, role: "Featured" }],
    })
    .mockResolvedValueOnce({ id: 2, isrc: "USAAA0000001", artist: { id: 42 } });
  expect(await isrcsFromDeezer("42", true)).toEqual(["USAAA0000001"]);
});

it("does not use producer-only or unspecified contributor roles as artist-credit proof", async () => {
  for (const role of ["Producer", "Composer", undefined]) {
    fetchJson.mockResolvedValueOnce({ data: [{ id: 1 }] }).mockResolvedValueOnce({
      id: 1,
      isrc: "USAAA0000001",
      artist: { id: 99 },
      contributors: [{ id: 42, role }],
    });
    await expect(isrcsFromDeezer("42", true)).rejects.toThrow("credit");
  }
});
