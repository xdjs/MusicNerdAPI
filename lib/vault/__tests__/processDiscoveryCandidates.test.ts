import { beforeEach, expect, it, vi } from "vitest";
import { goodPage, hit, searchRun } from "@/lib/vault/__tests__/searchRun";
import { normalizeLoreDiscoveryUrl } from "@/lib/sources/normalizeLoreDiscoveryUrl";

const h = vi.hoisted(() => ({ resolve: vi.fn(), read: vi.fn(), judge: vi.fn(), file: vi.fn() }));
vi.mock("@/lib/vault/resolveCandidateUrls", () => ({ resolveCandidateUrls: h.resolve }));
vi.mock("@/lib/vault/readCandidates", () => ({ readCandidates: h.read }));
vi.mock("@/lib/vault/judgeCandidates", () => ({ judgeCandidates: h.judge }));
vi.mock("@/lib/vault/fileCandidate", () => ({ fileCandidate: h.file }));
const { processDiscoveryCandidates } = await import("@/lib/vault/processDiscoveryCandidates");

beforeEach(() => {
  h.resolve.mockReset().mockImplementation(async x => x);
  h.read
    .mockReset()
    .mockImplementation(async results =>
      results.map((result: ReturnType<typeof hit>) => ({ result, page: goodPage })),
    );
  h.judge.mockReset().mockResolvedValue(new Map());
  h.file.mockReset().mockResolvedValue(undefined);
});

it("keeps rejected and duplicate URLs out of page reads in every batch", async () => {
  const a = hit("https://magazine.example/a");
  const b = hit("https://magazine.example/b");
  const rejected = new Set([normalizeLoreDiscoveryUrl(a.url)]);
  const run = searchRun({ existingUrls: new Set(rejected) });
  await processDiscoveryCandidates(run, [a, b, b], rejected, { name: "Grimes" });
  expect(h.read).toHaveBeenCalledWith([b]);
  await processDiscoveryCandidates(run, [a, b], rejected, { name: "Grimes" });
  expect(h.read).toHaveBeenCalledTimes(1);
});

it("rechecks a fetched redirect against the artist's rejected URLs before filing", async () => {
  const original = hit("https://magazine.example/new");
  const rejected = hit("https://magazine.example/rejected");
  const rejectedUrls = new Set([normalizeLoreDiscoveryUrl(rejected.url)]);
  const run = searchRun({ existingUrls: new Set(rejectedUrls) });
  h.read.mockResolvedValue([{ result: rejected, discoveredUrl: original.url, page: goodPage }]);
  await processDiscoveryCandidates(run, [original], rejectedUrls, { name: "Grimes" });
  expect(h.file).not.toHaveBeenCalled();
});
