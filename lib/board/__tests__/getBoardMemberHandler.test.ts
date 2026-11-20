import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { getBoardMemberHandler } from "@/lib/board/getBoardMemberHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/board/authenticateBoardMember", () => ({ authenticateBoardMember: mock.auth }));

const request = () => new Request("https://api.musicnerd.test/api/board/member");

beforeEach(() => vi.clearAllMocks());

describe("getBoardMemberHandler", () => {
  it("returns the member's name", async () => {
    mock.auth.mockResolvedValueOnce({ name: "sweetman" });
    const res = await getBoardMemberHandler(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", name: "sweetman" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("forwards the member check's response", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not on the team" }, { status: 403 }),
    );
    expect((await getBoardMemberHandler(request())).status).toBe(403);
  });

  it("answers a failure with a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.auth.mockRejectedValueOnce(new Error("privy down"));
    const res = await getBoardMemberHandler(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
