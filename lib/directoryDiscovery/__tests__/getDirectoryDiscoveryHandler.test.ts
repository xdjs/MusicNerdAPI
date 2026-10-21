import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({ auth: vi.fn(), status: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: mock.auth }));
vi.mock("@/lib/directoryDiscovery/getDirectoryDiscoveryStatus", () => ({
  getDirectoryDiscoveryStatus: mock.status,
}));
const { getDirectoryDiscoveryHandler } =
  await import("@/lib/directoryDiscovery/getDirectoryDiscoveryHandler");

const id = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const get = (artistId = id) =>
  getDirectoryDiscoveryHandler(new Request(`https://api.test/api/artist/${artistId}`), artistId);

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "u1" });
  mock.status.mockResolvedValue({ state: "active", revision: "r1" });
});

describe("getDirectoryDiscoveryHandler", () => {
  it("returns the state and revision to the viewer, private and uncached", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({ status: "ok", state: "active", revision: "r1" });
    expect(mock.status).toHaveBeenCalledWith(id, "u1");
  });

  it.each([
    ["a bad id", () => get("nope"), 400, "Invalid artist"],
    [
      "nothing to observe",
      () => (mock.status.mockResolvedValueOnce(null), get()),
      404,
      "Discovery is unavailable.",
    ],
    [
      "a failed read",
      () => (
        mock.status.mockImplementationOnce(async () => {
          throw new Error("offline");
        }),
        get()
      ),
      503,
      "Discovery could not be checked.",
    ],
  ])("answers %s uncached", async (_case, run, status, error) => {
    const res = await run();
    expect(res.status).toBe(status);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ status: "error", error });
  });

  it("keeps a sign-in failure uncached too", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const res = await get();
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mock.status).not.toHaveBeenCalled();
  });
});
