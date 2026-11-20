import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { postRevokeBoardKeyHandler } from "@/lib/board/postRevokeBoardKeyHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), revoke: vi.fn() }));
vi.mock("@/lib/board/authenticateBoardMember", () => ({ authenticateBoardMember: mock.auth }));
vi.mock("@/lib/board/revokeBoardKey", () => ({ revokeBoardKey: mock.revoke }));

const id = "5b2f1c3e-8d4a-4f6b-9e21-7a0c3d9b1e44";
const request = () =>
  new Request(`https://api.musicnerd.test/api/board/keys/${id}/revoke`, { method: "POST" });

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ name: "sweetman" });
});

describe("postRevokeBoardKeyHandler", () => {
  it("revokes the member's key", async () => {
    mock.revoke.mockResolvedValueOnce(true);
    const res = await postRevokeBoardKeyHandler(request(), id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", message: "Key revoked" });
    expect(mock.revoke).toHaveBeenCalledWith("sweetman", id);
  });

  it("is 404 when the member has no working key with that id", async () => {
    mock.revoke.mockResolvedValueOnce(false);
    const res = await postRevokeBoardKeyHandler(request(), id);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", error: "Key not found" });
  });

  it("is 400 for an id that isn't a UUID", async () => {
    expect((await postRevokeBoardKeyHandler(request(), "nope")).status).toBe(400);
    expect(mock.revoke).not.toHaveBeenCalled();
  });

  it("forwards the member check's response", async () => {
    mock.auth.mockResolvedValueOnce(NextResponse.json({}, { status: 403 }));
    expect((await postRevokeBoardKeyHandler(request(), id)).status).toBe(403);
  });
});
