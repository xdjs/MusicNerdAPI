import { it, expect, vi, afterEach } from "vitest";
import { fetchMandatoryInterviewMemory } from "@/lib/interviewMemory/fetchMandatoryInterviewMemory";
import { pageInterviewMemory } from "@/lib/interviewMemory/pageInterviewMemory";
const config = {
  apiOrigin: "https://api.example",
  artistId: "11111111-1111-4111-8111-111111111111",
  getAccessToken: async () => "private-token",
};
afterEach(() => vi.unstubAllGlobals());
it("loads complete mandatory memory through a host-bound authenticated API call", async () => {
  const body = pageInterviewMemory(
    { artistId: config.artistId, sitting: 2, entries: [] },
    { maxChars: 12000 },
  );
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(body));
  vi.stubGlobal("fetch", fetch);
  const r = await fetchMandatoryInterviewMemory(config, 2);
  expect(r.constraintsComplete).toBe(true);
  expect(String(fetch.mock.calls[0][0])).toContain(
    `/artist/${config.artistId}/interview/memory?sitting=2`,
  );
  expect(fetch.mock.calls[0][1]).toMatchObject({
    cache: "no-store",
    redirect: "error",
    headers: { Authorization: "Bearer private-token" },
  });
});
it("fails on unavailable or malformed memory rather than returning no boundaries", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: "ok", entries: [] })));
  await expect(fetchMandatoryInterviewMemory(config, 2)).rejects.toThrow();
});
it("validates the API destination before obtaining the token", async () => {
  const getAccessToken = vi.fn();
  await expect(
    fetchMandatoryInterviewMemory(
      { ...config, apiOrigin: "https://api.example/other", getAccessToken },
      2,
    ),
  ).rejects.toThrow();
  expect(getAccessToken).not.toHaveBeenCalled();
});
it("bounds a credential callback that never completes", async () => {
  await expect(
    fetchMandatoryInterviewMemory(
      { ...config, timeoutMs: 100, getAccessToken: () => new Promise(() => {}) },
      2,
    ),
  ).rejects.toThrow(/timed out/);
});
it("follows continuations and restores exact words across response boundaries", async () => {
  const answer = "Keep the exact 🥁 words. ".repeat(600);
  const snapshot = {
    artistId: config.artistId,
    sitting: 2,
    entries: [
      {
        entryId: "answer:1",
        revision: "a".repeat(64),
        kind: "latest_answer" as const,
        metadata: {},
        fields: [
          { name: "question", text: "Why?", start: 0, end: 4, totalChars: 4, complete: true },
          {
            name: "answer",
            text: answer,
            start: 0,
            end: answer.length,
            totalChars: answer.length,
            complete: true,
          },
        ],
      },
    ],
  };
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async url => {
    const query = new URL(String(url)).searchParams;
    return Response.json(
      pageInterviewMemory(snapshot, { maxChars: 12000, cursor: query.get("cursor") ?? undefined }),
    );
  });
  vi.stubGlobal("fetch", fetch);
  const result = await fetchMandatoryInterviewMemory(config, 2);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(result.entries[0].fields.find(f => f.name === "answer")?.text).toBe(answer);
});
it("does not retry a changed snapshot as an empty memory result", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ status: "error" }, { status: 409 })),
  );
  await expect(fetchMandatoryInterviewMemory(config, 2)).rejects.toThrow(/409/);
});
