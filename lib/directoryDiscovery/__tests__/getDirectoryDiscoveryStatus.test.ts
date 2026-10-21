import { it, expect, vi, beforeEach } from "vitest";

const mock = vi.hoisted(() => ({
  execute: vi.fn(),
  findSources: vi.fn(),
  getArtistById: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({
  db: {
    execute: mock.execute,
    query: { artistVaultSources: { findMany: mock.findSources } },
  },
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: mock.getArtistById }));
vi.mock("@/lib/links/getArtistLinks", () => ({ getArtistLinks: async () => [] }));
vi.mock("@/lib/musicLinks/getConflictingMusicSourceIds", () => ({
  getConflictingMusicSourceIds: async () => [],
}));
vi.mock("@/lib/links/getHiddenLinkSourceIds", () => ({ getHiddenLinkSourceIds: async () => [] }));
const { getDirectoryDiscoveryStatus } =
  await import("@/lib/directoryDiscovery/getDirectoryDiscoveryStatus");

beforeEach(() => {
  mock.execute.mockReset();
  mock.getArtistById.mockReset().mockResolvedValue({ id: "artist", deezer: "123" });
  mock.findSources.mockReset().mockResolvedValue([]);
});

it("reads nothing else when the viewer may not observe the add", async () => {
  mock.execute.mockResolvedValue([]);
  expect(await getDirectoryDiscoveryStatus("artist", "viewer")).toBeNull();
  expect(mock.getArtistById).not.toHaveBeenCalled();
  expect(mock.findSources).not.toHaveBeenCalled();
});

it.each(["active", "complete", "failed", "stopped"])(
  "returns only %s and a public fingerprint",
  async state => {
    mock.execute.mockResolvedValue([{ state, private_state: { passage: "secret" } }]);
    expect(await getDirectoryDiscoveryStatus("artist", "viewer")).toEqual({
      state,
      revision: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  },
);

it("refuses an unknown state and does not report a failed read as finished", async () => {
  mock.execute.mockResolvedValueOnce([{ state: "weird" }]);
  await expect(getDirectoryDiscoveryStatus("artist", "viewer")).rejects.toThrow(
    "Invalid discovery status",
  );
  mock.execute.mockImplementationOnce(async () => {
    throw new Error("unavailable");
  });
  await expect(getDirectoryDiscoveryStatus("artist", "viewer")).rejects.toThrow("unavailable");
});

it("reads the status before the destinations, so a final write is included", async () => {
  mock.execute.mockResolvedValue([{ state: "complete" }]);
  await getDirectoryDiscoveryStatus("artist", "viewer");
  expect(mock.execute.mock.invocationCallOrder[0]).toBeLessThan(
    mock.getArtistById.mock.invocationCallOrder[0],
  );
});
