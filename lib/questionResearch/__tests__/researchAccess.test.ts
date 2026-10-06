import { it, expect, vi, afterEach } from "vitest";
import { authenticateResearchRequest } from "@/lib/questionResearch/authenticateResearchRequest";
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({
  validateArtistEditRequest: vi.fn(async () => ({ artistId: "artist", userId: "user" })),
}));
afterEach(() => vi.unstubAllEnvs());
it("fails closed when a service key is supplied but not configured", async () => {
  vi.stubEnv("MUSICNERD_RESEARCH_API_KEY", "");
  await expect(
    authenticateResearchRequest(
      new Request("https://api.example", { headers: { "X-MusicNerd-Research-Key": "secret" } }),
      "artist",
    ),
  ).rejects.toMatchObject({ status: 503 });
});
it("does not promote service auth into private artist auth", async () => {
  vi.stubEnv("MUSICNERD_RESEARCH_API_KEY", "a".repeat(32));
  const req = new Request("https://api.example", {
    headers: { "X-MusicNerd-Research-Key": "a".repeat(32) },
  });
  expect(await authenticateResearchRequest(req, "artist")).toEqual({ kind: "service" });
  await expect(authenticateResearchRequest(req, "artist", true)).rejects.toMatchObject({
    status: 403,
  });
});
it("rejects mismatched service credentials", async () => {
  vi.stubEnv("MUSICNERD_RESEARCH_API_KEY", "a".repeat(32));
  await expect(
    authenticateResearchRequest(
      new Request("https://api.example", {
        headers: { "X-MusicNerd-Research-Key": "b".repeat(32) },
      }),
      "artist",
    ),
  ).rejects.toMatchObject({ status: 401 });
});
it("derives artist account identity from verified Privy auth", async () => {
  expect(
    await authenticateResearchRequest(new Request("https://api.example"), "artist", true),
  ).toEqual({ kind: "artist", userId: "user" });
});
