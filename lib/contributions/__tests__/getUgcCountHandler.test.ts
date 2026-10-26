import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { getUgcCountHandler } from "@/lib/contributions/getUgcCountHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: mock.auth }));
vi.mock("@/lib/contributions/countUserUgc", () => ({ countUserUgc: mock.count }));
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "token-user" });
  mock.count.mockResolvedValue(42);
});

describe("getUgcCountHandler", () => {
  it("counts every submission of the token's user", async () => {
    const response = await getUgcCountHandler(new Request("https://example.org/api/ugcCount"));
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(mock.count).toHaveBeenCalledWith("token-user");
    expect(await response.json()).toEqual({ status: "ok", count: 42 });
  });

  it("answers 0 with a 200 when signed out or when the count can't be read, as the website did", async () => {
    mock.auth.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const signedOut = await getUgcCountHandler(new Request("https://example.org/api/ugcCount"));
    expect(signedOut.status).toBe(200);
    expect(await signedOut.json()).toEqual({ status: "ok", count: 0 });
    expect(mock.count).not.toHaveBeenCalled();
    mock.auth.mockResolvedValue({ userId: "token-user" });
    mock.count.mockRejectedValue(new Error("db down"));
    const failed = await getUgcCountHandler(new Request("https://example.org/api/ugcCount"));
    expect(failed.status).toBe(200);
    expect(await failed.json()).toEqual({ status: "ok", count: 0 });
  });
});
