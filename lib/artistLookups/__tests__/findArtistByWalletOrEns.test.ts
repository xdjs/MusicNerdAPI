import { beforeEach, describe, expect, it, vi } from "vitest";

const { find, byWallet } = vi.hoisted(() => ({ find: vi.fn(), byWallet: vi.fn() }));
vi.mock("@/lib/artistLookups/findArtistByColumn", () => ({ findArtistByColumn: find }));
vi.mock("@/lib/artistLookups/findArtistByWallet", () => ({
  findArtistByWallet: byWallet,
}));
const { findArtistByWalletOrEns } = await import("@/lib/artistLookups/findArtistByWalletOrEns");
const { lookupArtists } = await import("@/lib/artistLookups/lookupArtists");

const WALLET = "0x00000000000000000000000000000000000000aB";
beforeEach(() => vi.clearAllMocks());

describe("findArtistByWalletOrEns", () => {
  it("matches a 0x address against wallets first", async () => {
    byWallet.mockResolvedValueOnce({ x: "w" });
    expect(await findArtistByWalletOrEns(WALLET)).toEqual({ x: "w" });
    expect(byWallet).toHaveBeenCalledWith(WALLET);
    expect(find).not.toHaveBeenCalled();
  });

  it("falls back to ENS when no wallet matches", async () => {
    byWallet.mockResolvedValueOnce(undefined);
    find.mockResolvedValueOnce({ x: "e" });
    expect(await findArtistByWalletOrEns(WALLET)).toEqual({ x: "e" });
    expect(find).toHaveBeenCalledWith(lookupArtists.ens, WALLET);
  });

  it("matches anything else against ENS only", async () => {
    find.mockResolvedValueOnce(undefined);
    expect(await findArtistByWalletOrEns("pete.eth")).toBeUndefined();
    expect(byWallet).not.toHaveBeenCalled();
    expect(find).toHaveBeenCalledWith(lookupArtists.ens, "pete.eth");
  });
});
