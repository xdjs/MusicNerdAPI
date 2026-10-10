import { beforeEach, describe, expect, it, vi } from "vitest";

const { find, byWallet } = vi.hoisted(() => ({ find: vi.fn(), byWallet: vi.fn() }));
vi.mock("@/lib/legacyLookups/findLegacyArtist", () => ({ findLegacyArtist: find }));
vi.mock("@/lib/legacyLookups/findLegacyArtistByWallet", () => ({
  findLegacyArtistByWallet: byWallet,
}));
const { findLegacyArtistByWalletOrEns } =
  await import("@/lib/legacyLookups/findLegacyArtistByWalletOrEns");
const { legacyArtists } = await import("@/lib/legacyLookups/legacyArtists");

const WALLET = "0x00000000000000000000000000000000000000aB";
beforeEach(() => vi.clearAllMocks());

describe("findLegacyArtistByWalletOrEns", () => {
  it("matches a 0x address against wallets first", async () => {
    byWallet.mockResolvedValueOnce({ x: "w" });
    expect(await findLegacyArtistByWalletOrEns(WALLET)).toEqual({ x: "w" });
    expect(byWallet).toHaveBeenCalledWith(WALLET);
    expect(find).not.toHaveBeenCalled();
  });

  it("falls back to ENS when no wallet matches", async () => {
    byWallet.mockResolvedValueOnce(undefined);
    find.mockResolvedValueOnce({ x: "e" });
    expect(await findLegacyArtistByWalletOrEns(WALLET)).toEqual({ x: "e" });
    expect(find).toHaveBeenCalledWith(legacyArtists.ens, WALLET);
  });

  it("matches anything else against ENS only", async () => {
    find.mockResolvedValueOnce(undefined);
    expect(await findLegacyArtistByWalletOrEns("pete.eth")).toBeUndefined();
    expect(byWallet).not.toHaveBeenCalled();
    expect(find).toHaveBeenCalledWith(legacyArtists.ens, "pete.eth");
  });
});
