import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({
  consume: vi.fn(),
  revoke: vi.fn(),
  touch: vi.fn(),
  pair: vi.fn(),
}));
vi.mock("@/lib/oauth/consumeOAuthToken", () => ({ consumeOAuthToken: mock.consume }));
vi.mock("@/lib/oauth/deleteGrantOfUsedRefreshToken", () => ({
  deleteGrantOfUsedRefreshToken: mock.revoke,
}));
vi.mock("@/lib/oauth/touchOAuthGrant", () => ({ touchOAuthGrant: mock.touch }));
vi.mock("@/lib/oauth/issueTokenPair", () => ({ issueTokenPair: mock.pair }));
const { refreshAccessToken } = await import("@/lib/oauth/refreshAccessToken");

const form = (over: Record<string, string> = {}) =>
  new URLSearchParams({
    grant_type: "refresh_token",
    client_id: "c1",
    refresh_token: "mn_rt_old",
    ...over,
  });
const pair = { access_token: "mn_at_x" };
const errorOf = async (res: unknown) => {
  expect(res).toBeInstanceOf(NextResponse);
  return ((await (res as NextResponse).json()) as { error: string }).error;
};

beforeEach(() => {
  vi.clearAllMocks();
  mock.consume.mockResolvedValue({ grantId: "grant-1", clientId: "c1" });
  mock.pair.mockResolvedValue(pair);
});

describe("refreshAccessToken", () => {
  it("rotates: consumes the refresh token, marks the grant used and issues a new pair", async () => {
    expect(await refreshAccessToken(form())).toBe(pair);
    expect(mock.consume).toHaveBeenCalledWith("mn_rt_old", "refresh");
    expect(mock.touch).toHaveBeenCalledWith("grant-1");
    expect(mock.pair).toHaveBeenCalledWith("grant-1");
    expect(mock.revoke).not.toHaveBeenCalled();
  });

  it("on a replayed or unknown refresh token revokes its grant and is invalid_grant", async () => {
    mock.consume.mockResolvedValue(undefined);
    expect(await errorOf(await refreshAccessToken(form()))).toBe("invalid_grant");
    expect(mock.revoke).toHaveBeenCalledWith("mn_rt_old");
    expect(mock.pair).not.toHaveBeenCalled();
  });

  it("is invalid_grant for another client's refresh token", async () => {
    expect(await errorOf(await refreshAccessToken(form({ client_id: "c2" })))).toBe(
      "invalid_grant",
    );
    expect(mock.pair).not.toHaveBeenCalled();
  });

  it("is invalid_request without a refresh token", async () => {
    const params = form();
    params.delete("refresh_token");
    expect(await errorOf(await refreshAccessToken(params))).toBe("invalid_request");
    expect(mock.consume).not.toHaveBeenCalled();
  });
});
