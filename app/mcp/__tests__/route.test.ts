import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/db", () => ({ db: {} }));
const route = await import("@/app/mcp/route");

const post = (body: unknown) =>
  new Request("https://api/mcp", {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "Mcp-Protocol-Version": "2025-06-18",
    },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("/mcp", () => {
  it("serves only POST and the OPTIONS preflight, so GET and DELETE answer 405", () => {
    expect(
      Object.keys(route)
        .filter(k => k !== "dynamic")
        .sort(),
    ).toEqual(["OPTIONS", "POST"]);
  });

  it("OPTIONS answers the preflight with CORS headers and no body", async () => {
    const response = await route.OPTIONS();
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(await response.text()).toBe("");
  });

  it("POST lists the tools", async () => {
    const response = await route.POST(post({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
    expect(response.status).toBe(200);
    const data = JSON.parse(
      (await response.text())
        .split("\n")
        .find(l => l.startsWith("data: "))!
        .slice(6),
    );
    expect(data.result.tools.map((t: { name: string }) => t.name)).toContain("search_artists");
  });
});
