import { beforeEach, describe, expect, it, vi } from "vitest";

const { byWallet, byName } = vi.hoisted(() => ({ byWallet: vi.fn(), byName: vi.fn() }));
vi.mock("@/lib/legacyLookups/findLegacyArtistByWalletOrEns", () => ({
  findLegacyArtistByWalletOrEns: byWallet,
}));
vi.mock("@/lib/legacyLookups/searchLegacyArtistByName", () => ({
  searchLegacyArtistByName: byName,
}));
const { findTwitterHandleHandler } = await import("@/lib/legacyLookups/findTwitterHandleHandler");

const MISSING = "Missing or invalid required parameters: name or ethAddress";
const run = (body: string) =>
  findTwitterHandleHandler(
    new Request("https://api.test/api/findTwitterHandle", { method: "POST", body }),
  );
beforeEach(() => vi.clearAllMocks());

describe("findTwitterHandleHandler", () => {
  it("answers { result: x } for an ethAddress match, preferring it over name", async () => {
    byWallet.mockResolvedValueOnce({ x: "pete" });
    const r = await run('{"ethAddress":"pete.eth","name":"Someone"}');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ result: "pete" });
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(byName).not.toHaveBeenCalled();
  });

  it("answers { result: null } when the artist has no X handle", async () => {
    byWallet.mockResolvedValueOnce({ x: null });
    expect(await (await run('{"ethAddress":"pete.eth"}')).json()).toEqual({ result: null });
  });

  it("answers the legacy 404 when an ethAddress matches nothing", async () => {
    byWallet.mockResolvedValueOnce(undefined);
    const r = await run('{"ethAddress":"nobody.eth"}');
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("The artist you're searching for is not found");
  });

  it("answers { result: x } for a name match", async () => {
    byName.mockResolvedValueOnce({ x: "peterango" });
    const r = await run('{"name":"Pete Rango"}');
    expect(await r.json()).toEqual({ result: "peterango" });
    expect(byName).toHaveBeenCalledWith("Pete Rango");
  });

  it("answers 200 {} when a name matches nothing, as the legacy route did", async () => {
    byName.mockResolvedValueOnce(undefined);
    const r = await run('{"name":"zzzz"}');
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("{}");
  });

  it("answers the legacy 400 when neither field is a non-empty string or the body isn't JSON", async () => {
    for (const body of ["{}", '{"name":""}', '{"ethAddress":"","name":""}', '{"name":5}', "nope"]) {
      const r = await run(body);
      expect(r.status).toBe(400);
      expect(await r.text()).toBe(MISSING);
    }
  });

  it("answers 500 when the database fails", async () => {
    byName.mockRejectedValueOnce(new Error("secret SQL"));
    const r = await run('{"name":"Pete"}');
    expect(r.status).toBe(500);
    expect(await r.text()).toBe("Something went wrong on our end");
  });
});
