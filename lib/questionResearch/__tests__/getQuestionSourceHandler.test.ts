import { beforeEach, expect, it, vi } from "vitest";
import { getQuestionSourceHandler } from "@/lib/questionResearch/getQuestionSourceHandler";
const m = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/questionResearch/readResearchOriginal", () => ({ readResearchOriginal: m.read }));
const id = "11111111-1111-4111-8111-111111111111";
const sourceId = "vault:33333333-3333-4333-8333-333333333333";
const revision = "a".repeat(64);
const get = (query: string) =>
  new Request(`https://api.example/api/artist/${id}/questionResearch/source?${query}`);
const passage = {
  sourceId,
  revision,
  start: 0,
  end: 4,
  text: "text",
  url: "https://example.com/a",
  curation: "approved",
  evidenceKind: "original_text",
  speaker: "not_applicable",
  publishedAt: null,
  retrievedAt: null,
  truncated: null,
};
beforeEach(() => vi.resetAllMocks());
it("reads the cited window as the public service with Web's fixed 12,000 characters", async () => {
  m.read.mockResolvedValue({
    status: "ok",
    passage: { ...passage, internal: 1 },
    totalChars: 4,
    nextStart: null,
    extra: true,
  });
  const r = await getQuestionSourceHandler(
    get(`sourceId=${encodeURIComponent(sourceId)}&revision=${revision}&start=0`),
    id,
  );
  expect(r.status).toBe(200);
  expect(r.headers.get("Cache-Control")).toBe("private, no-store");
  expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(await r.json()).toEqual({ status: "ok", passage, totalChars: 4, nextStart: null });
  expect(m.read).toHaveBeenCalledWith(id, { kind: "service" }, sourceId, revision, 0, 12000);
});
it("rejects a bad artist, source, revision or an extra parameter with Web's 400", async () => {
  for (const [artist, query] of [
    ["x", `sourceId=${sourceId}&revision=${revision}`],
    [id, `sourceId=nope&revision=${revision}`],
    [id, `sourceId=${sourceId}&revision=abc`],
    [id, `sourceId=${sourceId}&revision=${revision}&maxChars=4000`],
  ]) {
    const r = await getQuestionSourceHandler(get(query), artist);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ status: "error", error: "Invalid source reference" });
  }
  expect(m.read).not.toHaveBeenCalled();
});
it("answers a changed, unavailable or failed read with Web's JSON 409 and CORS", async () => {
  m.read.mockRejectedValue(new Error("connection refused"));
  const r = await getQuestionSourceHandler(get(`sourceId=${sourceId}&revision=${revision}`), id);
  expect(r.status).toBe(409);
  expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(await r.json()).toEqual({
    status: "error",
    error: "This original changed or is no longer available. Refresh the research.",
  });
});
