import { beforeEach, describe, expect, it, vi } from "vitest";

const { validate } = vi.hoisted(() => ({ validate: vi.fn() }));
vi.mock("@/lib/oauth/validateAuthorizeRequest", () => ({ validateAuthorizeRequest: validate }));
const { getConsentHandler } = await import("@/lib/oauth/getConsentHandler");

const read = () =>
  getConsentHandler(
    new Request("https://api.musicnerd.net/api/oauth/consent?client_id=c1&state=xyz"),
  );

beforeEach(() => {
  validate.mockReset();
});

describe("getConsentHandler", () => {
  it("names the agent and the host it returns to", async () => {
    validate.mockResolvedValue({
      ok: true,
      client: { id: "c1", name: "Claude", redirectUris: [] },
      redirectUri: "http://127.0.0.1:33418/callback",
    });
    const res = await read();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({
      status: "ok",
      agent: "Claude",
      redirectHost: "127.0.0.1:33418",
    });
    expect(validate).toHaveBeenCalledWith(
      { client_id: "c1", state: "xyz" },
      "https://api.musicnerd.net",
    );
  });

  it.each([
    ["an unknown client", { ok: false, redirectUri: null }],
    ["missing PKCE", { ok: false, redirectUri: "https://a.example/cb", error: "invalid_request" }],
  ])("is a 400 for %s", async (_label, result) => {
    validate.mockResolvedValue(result);
    const res = await read();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Invalid authorization request" });
  });

  it("is a 500 when the client can't be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    validate.mockImplementation(async () => {
      throw new Error("db down");
    });
    expect((await read()).status).toBe(500);
  });
});
