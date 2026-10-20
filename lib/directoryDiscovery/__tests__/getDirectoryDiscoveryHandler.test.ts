import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  execute: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: mock.auth }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));

import { getDirectoryDiscoveryHandler } from "@/lib/directoryDiscovery/getDirectoryDiscoveryHandler";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("getDirectoryDiscoveryHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.auth.mockResolvedValue({ userId: "u1" });
    mock.execute.mockResolvedValue([]);
  });

  it("returns 200 with the discovery state", async () => {
    mock.execute.mockResolvedValueOnce([{ state: "active" }]);
    const response = await getDirectoryDiscoveryHandler(new Request("http://localhost"), validId);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", state: "active" });
  });

  it("returns 400 for a non-UUID id", async () => {
    const response = await getDirectoryDiscoveryHandler(new Request("http://localhost"), "bad");
    expect(response.status).toBe(400);
    expect(mock.auth).not.toHaveBeenCalled();
  });

  it("passes through 401 from auth", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const response = await getDirectoryDiscoveryHandler(new Request("http://localhost"), validId);
    expect(response.status).toBe(401);
  });

  it("returns 404 when no row is found", async () => {
    mock.execute.mockResolvedValueOnce([]);
    const response = await getDirectoryDiscoveryHandler(new Request("http://localhost"), validId);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "Discovery is unavailable" });
  });

  it("includes CORS headers on success", async () => {
    mock.execute.mockResolvedValueOnce([{ state: "complete" }]);
    const response = await getDirectoryDiscoveryHandler(new Request("http://localhost"), validId);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
