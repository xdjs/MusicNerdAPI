import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { postBoardKeysHandler } from "@/lib/board/postBoardKeysHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/board/authenticateBoardMember", () => ({ authenticateBoardMember: mock.auth }));
vi.mock("@/lib/board/createBoardKey", () => ({ createBoardKey: mock.create }));

const request = (body: string) =>
  new Request("https://api.musicnerd.test/api/board/keys", { method: "POST", body });

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ name: "sweetman" });
  mock.create.mockResolvedValue({ id: "k1", rawKey: "abc" });
});

describe("postBoardKeysHandler", () => {
  it("makes a key and returns its MCP URL on this API's origin", async () => {
    const res = await postBoardKeysHandler(request('{"agent":"Claude Duet"}'));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      status: "ok",
      id: "k1",
      agent: "claude-duet",
      profile: "claude-duet-sweetman",
      url: "https://api.musicnerd.test/api/board/mcp/abc",
    });
    expect(mock.create).toHaveBeenCalledWith("sweetman", "claude-duet");
  });

  it("is 400 for an unusable agent name, before making anything", async () => {
    expect((await postBoardKeysHandler(request('{"agent":"!"}'))).status).toBe(400);
    expect(mock.create).not.toHaveBeenCalled();
  });

  it("forwards the member check's response", async () => {
    mock.auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await postBoardKeysHandler(request('{"agent":"x"}'))).status).toBe(401);
    expect(mock.create).not.toHaveBeenCalled();
  });

  it("answers a failure with a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.create.mockRejectedValueOnce(new Error("db down"));
    expect((await postBoardKeysHandler(request('{"agent":"x"}'))).status).toBe(500);
  });
});
