import { NextResponse } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  execute: vi.fn(),
  values: vi.fn(),
  activity: vi.fn(),
  refresh: vi.fn(),
  upload: vi.fn(),
  duplicate: false,
  trusted: false,
}));
const writer = { execute: m.execute, insert: () => ({ values: m.values }) };
vi.mock("@/lib/db/db", () => ({
  db: { transaction: async (fn: (tx: unknown) => unknown) => fn(writer) },
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({
  findApprovedClaim: async () => ({ id: "claim-other" }),
}));
vi.mock("@/lib/ownership/withArtistUploadWrite", () => ({ withArtistUploadWrite: m.upload }));
vi.mock("@/lib/vault/getVaultSourceUrlsByArtistId", () => ({
  getVaultSourceUrlsByArtistId: async () => [],
}));
vi.mock("@/lib/research/queueLoreRefresh", () => ({ queueLoreRefresh: m.refresh }));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: m.activity }));
vi.mock("@/lib/sourceExtraction/queueApprovedSourceExtraction", () => ({
  queueApprovedSourceExtraction: vi.fn(),
}));
const { postLoreSuggestionHandler } =
  await import("@/lib/loreSuggestions/postLoreSuggestionHandler");
const artist = "00000000-0000-4000-8000-000000000001";
const user = "00000000-0000-4000-8000-000000000002";
const request = () =>
  new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ url: "https://example.test/interview" }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.duplicate = false;
  m.trusted = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("External requests forbidden");
    }),
  );
  m.auth.mockResolvedValue({ userId: user });
  m.upload.mockRejectedValue(new Error("Suggestion must not require artist upload authorization"));
  m.execute.mockImplementation(async () => [{ is_admin: m.trusted, is_white_listed: false }]);
  m.activity.mockResolvedValue("receipt");
  m.values.mockImplementation(data => ({
    onConflictDoNothing: () => ({
      returning: async () => (m.duplicate ? [] : [{ id: "source", ...data }]),
    }),
  }));
});
it("lets a signed-in non-owner suggest a pending source without granting editor access", async () => {
  const response = await postLoreSuggestionHandler(request(), artist);
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ sourceStatus: "pending" });
  expect(m.upload).not.toHaveBeenCalled();
  expect(m.values).toHaveBeenCalledWith(
    expect.objectContaining({ status: "pending", origin: "submission" }),
  );
  expect(m.activity).toHaveBeenCalledWith(
    artist,
    "source_submission",
    expect.objectContaining({ userId: user, trigger: "visitor_suggestion" }),
    writer,
  );
  expect(m.refresh).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("uses current trust for approval and queues one refresh with the observed claim", async () => {
  m.trusted = true;
  expect((await postLoreSuggestionHandler(request(), artist)).status).toBe(201);
  expect(m.values).toHaveBeenCalledWith(expect.objectContaining({ status: "approved" }));
  expect(m.refresh).toHaveBeenCalledExactlyOnceWith(artist, "claim-other", {
    userId: user,
    trigger: "source_submission",
  });
});
it("reports a concurrent duplicate without another activity or refresh", async () => {
  m.duplicate = true;
  expect((await postLoreSuggestionHandler(request(), artist)).status).toBe(409);
  expect(m.activity).not.toHaveBeenCalled();
  expect(m.refresh).not.toHaveBeenCalled();
});
it("rejects unauthenticated input before persistence", async () => {
  m.auth.mockResolvedValue(NextResponse.json({ status: "error" }, { status: 401 }));
  expect((await postLoreSuggestionHandler(request(), artist)).status).toBe(401);
  expect(m.values).not.toHaveBeenCalled();
});
