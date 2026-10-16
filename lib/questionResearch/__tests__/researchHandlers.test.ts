import { it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { postQuestionResearchHandler } from "@/lib/questionResearch/postQuestionResearchHandler";
import { getQuestionResearchHandler } from "@/lib/questionResearch/getQuestionResearchHandler";
import { postContinueQuestionResearchHandler } from "@/lib/questionResearch/postContinueQuestionResearchHandler";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  queue: vi.fn(),
  status: vi.fn(),
  artist: vi.fn(),
  originals: vi.fn(),
  select: vi.fn(),
  continue: vi.fn(),
}));
vi.mock("@/lib/questionResearch/authenticateResearchRequest", () => ({
  authenticateResearchRequest: m.auth,
}));
vi.mock("@/lib/questionResearch/queueQuestionResearch", () => ({ queueQuestionResearch: m.queue }));
vi.mock("@/lib/questionResearch/getQuestionResearchStatus", () => ({
  getQuestionResearchStatus: m.status,
}));
vi.mock("@/lib/questionResearch/loadResearchArtist", () => ({ loadResearchArtist: m.artist }));
vi.mock("@/lib/questionResearch/loadPublicResearchOriginals", () => ({
  loadPublicResearchOriginals: m.originals,
}));
vi.mock("@/lib/questionResearch/selectDirectResearchCandidates", () => ({
  selectDirectResearchCandidates: m.select,
}));
vi.mock("@/lib/questionResearch/continueQuestionResearch", () => ({
  continueQuestionResearch: m.continue,
}));
const artist = "11111111-1111-4111-8111-111111111111",
  job = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ kind: "service" });
  m.queue.mockResolvedValue({ status: "ok", jobId: job, stage: "checking_saved" });
  m.artist.mockResolvedValue({ name: "Example" });
  m.originals.mockResolvedValue([]);
  m.select.mockReturnValue({ references: [] });
  m.continue.mockResolvedValue({
    status: "ok",
    jobId: job,
    selection: "research",
    stage: "checking_saved",
  });
});
it("strips the service-only direct option and prepares candidates before quota admission", async () => {
  const references = [{ sourceId: "vault:a" }];
  m.select.mockReturnValue({ references });
  const response = await postQuestionResearchHandler(
    new Request("https://api.example", {
      method: "POST",
      body: JSON.stringify({
        topic: "album credits",
        evidenceNeed: "credits",
        preferDirectEvidence: true,
      }),
    }),
    artist,
  );
  expect(response.status).toBe(202);
  expect(m.queue).toHaveBeenCalledWith(
    artist,
    { kind: "service" },
    { topic: "album credits", evidenceNeed: "credits", freshness: "stored" },
    { directCandidates: references },
  );
  expect(m.originals).toHaveBeenCalledOnce();
  expect(m.select.mock.invocationCallOrder[0]).toBeLessThan(m.queue.mock.invocationCallOrder[0]);
});
it("does not read candidates for legacy requests or a false option", async () => {
  const response = await postQuestionResearchHandler(
    new Request("https://api.example", {
      method: "POST",
      body: JSON.stringify({
        topic: "album credits",
        evidenceNeed: "credits",
        preferDirectEvidence: false,
      }),
    }),
    artist,
  );
  expect(response.status).toBe(202);
  expect(m.originals).not.toHaveBeenCalled();
  expect(m.queue.mock.calls[0][2]).not.toHaveProperty("preferDirectEvidence");
});
it.each(["yes", 1, {}, null])(
  "rejects malformed direct preference %j",
  async preferDirectEvidence => {
    const response = await postQuestionResearchHandler(
      new Request("https://api.example", {
        method: "POST",
        body: JSON.stringify({
          topic: "album credits",
          evidenceNeed: "credits",
          preferDirectEvidence,
        }),
      }),
      artist,
    );
    expect(response.status).toBe(400);
    expect(m.originals).not.toHaveBeenCalled();
    expect(m.queue).not.toHaveBeenCalled();
  },
);
it("rejects direct candidates for artist credentials before reading sources", async () => {
  m.auth.mockResolvedValue({ kind: "artist", userId: "user" });
  const response = await postQuestionResearchHandler(
    new Request("https://api.example", {
      method: "POST",
      body: JSON.stringify({
        topic: "album credits",
        evidenceNeed: "credits",
        preferDirectEvidence: true,
      }),
    }),
    artist,
  );
  expect(response.status).toBe(403);
  expect(m.originals).not.toHaveBeenCalled();
  expect(m.queue).not.toHaveBeenCalled();
});
it.each([undefined, "{}"])("continues with no client routing (%s)", async body => {
  const response = await postContinueQuestionResearchHandler(
    new Request("https://api.example", { method: "POST", body }),
    artist,
    job,
  );
  expect(response.status).toBe(202);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(m.continue).toHaveBeenCalledWith(artist, job, { kind: "service" });
});
it.each(['{"topic":"different"}', "[]", "null", "invalid"])(
  "refuses continuation body overrides %s",
  async body => {
    const response = await postContinueQuestionResearchHandler(
      new Request("https://api.example", { method: "POST", body }),
      artist,
      job,
    );
    expect(response.status).toBe(400);
    expect(m.continue).not.toHaveBeenCalled();
  },
);
it("requires a service credential and valid job for continuation", async () => {
  m.auth.mockResolvedValue({ kind: "artist", userId: "user" });
  expect(
    (
      await postContinueQuestionResearchHandler(
        new Request("https://api.example", { method: "POST" }),
        artist,
        job,
      )
    ).status,
  ).toBe(403);
  m.auth.mockResolvedValue({ kind: "service" });
  expect(
    (
      await postContinueQuestionResearchHandler(
        new Request("https://api.example", { method: "POST" }),
        artist,
        "invalid",
      )
    ).status,
  ).toBe(400);
  expect(m.continue).not.toHaveBeenCalled();
});
it("acknowledges durable enqueue with 202 and no-store", async () => {
  const r = await postQuestionResearchHandler(
    new Request("https://api.example", {
      method: "POST",
      body: JSON.stringify({ topic: "album credits", evidenceNeed: "credits" }),
    }),
    artist,
  );
  expect(r.status).toBe(202);
  expect(r.headers.get("cache-control")).toBe("private, no-store");
  expect(await r.json()).toMatchObject({ stage: "checking_saved" });
});
it("rejects invalid artist IDs even with a public service grant", async () => {
  expect(
    (await postQuestionResearchHandler(new Request("https://api.example"), "nope")).status,
  ).toBe(400);
  expect(m.queue).not.toHaveBeenCalled();
});
it("preserves failed authentication without reaching database work", async () => {
  m.auth.mockResolvedValue(
    NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
  );
  expect(
    (await getQuestionResearchHandler(new Request("https://api.example"), artist, job)).status,
  ).toBe(401);
  expect(m.status).not.toHaveBeenCalled();
});
it("does not expose private error text as a provider or absence result", async () => {
  m.status.mockRejectedValue(new Error("credential=private db statement"));
  const r = await getQuestionResearchHandler(new Request("https://api.example"), artist, job);
  expect(r.status).toBe(503);
  expect(JSON.stringify(await r.json())).not.toContain("credential");
});
