import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { getBoardKeysHandler } from "@/lib/board/getBoardKeysHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), keys: vi.fn() }));
vi.mock("@/lib/board/authenticateBoardMember", () => ({ authenticateBoardMember: mock.auth }));
vi.mock("@/lib/board/getBoardKeys", () => ({ getBoardKeys: mock.keys }));

const request = () => new Request("https://api.musicnerd.test/api/board/keys");

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ name: "sweetman" });
});

describe("getBoardKeysHandler", () => {
  it("lists the member's keys", async () => {
    mock.keys.mockResolvedValueOnce([{ id: "k1" }]);
    const res = await getBoardKeysHandler(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", keys: [{ id: "k1" }] });
    expect(mock.keys).toHaveBeenCalledWith("sweetman");
  });

  it("forwards the member check's response", async () => {
    mock.auth.mockResolvedValueOnce(NextResponse.json({}, { status: 403 }));
    expect((await getBoardKeysHandler(request())).status).toBe(403);
    expect(mock.keys).not.toHaveBeenCalled();
  });

  it("answers a failure with a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.keys.mockRejectedValueOnce(new Error("db down"));
    expect((await getBoardKeysHandler(request())).status).toBe(500);
  });
});
