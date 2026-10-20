import { describe, it, expect, vi } from "vitest";

const mockExecute = vi.fn().mockResolvedValue([
  {
    type: "research",
    artistId: "a1",
    artistName: "Test",
    platform: null,
    createdAt: "2024-01-01",
  },
]);
vi.mock("@/lib/db/db", () => ({ db: { execute: (...a: unknown[]) => mockExecute(...a) } }));

const { getActivityHandler } = await import("@/lib/activity/getActivityHandler");

describe("getActivityHandler", () => {
  it("returns 200 with activity array", async () => {
    const request = new Request("http://localhost/api/activity");
    const response = await getActivityHandler(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("carries CORS headers", async () => {
    const request = new Request("http://localhost/api/activity");
    const response = await getActivityHandler(request);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("accepts a since parameter", async () => {
    const request = new Request("http://localhost/api/activity?since=2024-01-01");
    const response = await getActivityHandler(request);
    expect(response.status).toBe(200);
  });
});
