import { expect, it, vi } from "vitest";
import { createSearchSourcesTool } from "@/lib/chat/createSearchSourcesTool";
import { createReadSourceTool } from "@/lib/chat/createReadSourceTool";
import { originalFixture } from "./originalFixture";
const call = { toolCallId: "c", messages: [] } as never;
const post = (id: string, date: string | null, text = "An update") => ({
  ...originalFixture(id, `https://www.instagram.com/p/${id}/`, text),
  publishedAt: date,
});

it("finds and cites September FWB post ahead of keyword-heavy older originals without HTTP", async () => {
  const sources = [
    ...Array.from({ length: 10 }, (_, i) =>
      post(`old${i}`, "2025-01-01T00:00:00Z", "latest recent news Instagram"),
    ),
    post("fwb", "2025-09-25T00:00:00Z", "FWB Fest was wonderful"),
    post("future", "2099-01-01T00:00:00Z"),
    post("unknown", null),
  ];
  const fetch = vi.spyOn(globalThis, "fetch");
  const result = (await createSearchSourcesTool(sources, "Pete Rango").execute!(
    { query: "latest Instagram", retrieval: "latest", platform: "instagram" },
    call,
  )) as { sources: { sourceId: string; publishedAt: string }[] };
  expect(result.sources[0].sourceId).toBe("fwb");
  expect(result.sources[0].publishedAt).toBe("2025-09-25T00:00:00Z");
  expect(result.sources.some(s => ["unknown", "future"].includes(s.sourceId))).toBe(false);
  const cite = vi.fn().mockReturnValue(1);
  const read = await createReadSourceTool(sources, cite).execute!({ sourceId: "fwb" }, call);
  expect(read).toMatchObject({
    n: 1,
    publishedAt: "2025-09-25T00:00:00Z",
    text: "FWB Fest was wonderful",
  });
  expect(cite).toHaveBeenCalledWith(
    expect.objectContaining({ url: "https://www.instagram.com/p/fwb/" }),
  );
  expect(fetch).not.toHaveBeenCalled();
  fetch.mockRestore();
});

it("keeps platform constraints on fallback results and returns stored-only coverage", async () => {
  const sources = [
    post("old", "2020-01-01T00:00:00Z"),
    { ...post("other", "2025-10-01T00:00:00Z"), url: "https://open.spotify.com/album/abc" },
  ];
  const result = (await createSearchSourcesTool(sources, "Pete Rango").execute!(
    { query: "newest", retrieval: "latest", platform: "instagram" },
    call,
  )) as { sources: { sourceId: string }[]; coverage: string };
  expect(result.sources.map(s => s.sourceId)).toEqual(["old"]);
  expect(result.coverage).toContain("stored");
});

it("returns no latest evidence for undated or empty originals", async () => {
  for (const sources of [[], [post("unknown", null)]]) {
    const result = (await createSearchSourcesTool(sources, "Pete Rango").execute!(
      { query: "newest", retrieval: "latest" },
      call,
    )) as { sources: unknown[]; coverage: string };
    expect(result.sources).toEqual([]);
    expect(result.coverage).toContain("stored");
  }
});

it("distinguishes a latest release from a newer social post", async () => {
  const sources = [
    post("post", "2025-10-01T00:00:00Z", "A new photo"),
    {
      ...post("release", "2025-09-01T00:00:00Z", "Album released September 1"),
      url: "https://open.spotify.com/album/album1",
      activityDate: "2025-09-01",
      activityDateKind: "release" as const,
    },
  ];
  const result = (await createSearchSourcesTool(sources, "Pete Rango").execute!(
    { query: "latest release", retrieval: "latest", evidenceNeed: "release_date" },
    call,
  )) as { sources: { sourceId: string; activityDate: string }[] };
  expect(result.sources).toHaveLength(1);
  expect(result.sources[0]).toMatchObject({ sourceId: "release", activityDate: "2025-09-01" });
});
