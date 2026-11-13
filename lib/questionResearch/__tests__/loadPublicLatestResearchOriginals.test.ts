import { expect, it, vi } from "vitest";
import { originalFixture } from "@/lib/chat/__tests__/originalFixture";

const m = vi.hoisted(() => ({
  transaction: vi.fn(),
  answers: vi.fn(),
  providers: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { transaction: m.transaction } }));
vi.mock("@/lib/questionResearch/loadPublicLatestOriginals", () => ({
  loadPublicLatestOriginals: m.answers,
}));
vi.mock("@/lib/latestProviders/getStoredLatestProviders", () => ({
  getStoredLatestProviders: m.providers,
}));
const { loadPublicLatestResearchOriginals } =
  await import("@/lib/questionResearch/loadPublicLatestResearchOriginals");

it("reads the public answers and stored latest providers in one read-only snapshot", async () => {
  const tx = { execute: vi.fn() };
  m.transaction.mockImplementation(async (run: (t: unknown) => unknown) => run(tx));
  const answer = originalFixture("public_answer:1", "https://musicnerd.net/artist/a", "An answer");
  const release = originalFixture(
    "latest:spotify:1",
    "https://open.spotify.com/album/x",
    "A release",
  );
  m.answers.mockResolvedValue([answer]);
  m.providers.mockResolvedValue({ originals: [release], coverage: [] });

  expect(await loadPublicLatestResearchOriginals("artist")).toEqual([answer, release]);
  expect(m.answers).toHaveBeenCalledWith(tx, "artist");
  expect(m.providers).toHaveBeenCalledWith("artist", tx);
  expect(m.transaction.mock.calls[0][1]).toEqual({
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
});
