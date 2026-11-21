import { beforeEach, describe, expect, it, vi } from "vitest";

const { insertOAuthClient } = vi.hoisted(() => ({ insertOAuthClient: vi.fn() }));
vi.mock("@/lib/oauth/insertOAuthClient", () => ({ insertOAuthClient }));
const { postRegisterClientHandler } = await import("@/lib/oauth/postRegisterClientHandler");

const register = (body: unknown) =>
  postRegisterClientHandler(
    new Request("https://api.musicnerd.net/api/oauth/reg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  insertOAuthClient.mockReset();
  insertOAuthClient.mockResolvedValue("2f6c1d0e-8a4b-4c47-9a51-3e0f7b9d2c18");
});

describe("postRegisterClientHandler", () => {
  it("registers a public client and answers 201 with its registration", async () => {
    const res = await register({
      client_name: "Claude",
      redirect_uris: ["http://127.0.0.1:33418/callback"],
      token_endpoint_auth_method: "client_secret_post",
    });
    expect(res.status).toBe(201);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({
      client_id: "2f6c1d0e-8a4b-4c47-9a51-3e0f7b9d2c18",
      client_name: "Claude",
      redirect_uris: ["http://127.0.0.1:33418/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    });
    expect(insertOAuthClient).toHaveBeenCalledWith("Claude", ["http://127.0.0.1:33418/callback"]);
  });

  it("answers a disallowed redirect with the OAuth error and stores nothing", async () => {
    const res = await register({ redirect_uris: ["http://example.com/cb"] });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "invalid_redirect_uri",
      error_description: expect.any(String),
    });
    expect(insertOAuthClient).not.toHaveBeenCalled();
  });

  it("answers a body that isn't JSON with invalid_client_metadata", async () => {
    const res = await register("{");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_client_metadata");
  });

  it("answers a database failure with a 500 server_error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    insertOAuthClient.mockRejectedValue(new Error("db down"));
    const res = await register({ redirect_uris: ["https://a.example/cb"] });
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: string }).error).toBe("server_error");
  });
});
