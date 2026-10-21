import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/db", () => ({ db: {} }));
const { handleMcpRequest } = await import("@/lib/mcp/handleMcpRequest");

const TOOLS = [
  "search_artists",
  "get_artist",
  "set_artist_link",
  "delete_artist_link",
  "get_unmapped_artists",
  "get_mapping_stats",
  "get_artist_mappings",
  "resolve_artist_id",
  "exclude_artist_mapping",
  "get_mapping_exclusions",
];
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://api/mcp", {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("handleMcpRequest", () => {
  it("answers initialize on an SSE stream with the server info and CORS headers", async () => {
    const response = await handleMcpRequest(
      post({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "t", version: "1" },
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^text\/event-stream/);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await response.text()).toContain('"serverInfo":{"name":"Music Nerd","version":"1.0.0"}');
  });

  it("lists exactly the ten tools", async () => {
    const response = await handleMcpRequest(
      post(
        { jsonrpc: "2.0", id: 2, method: "tools/list" },
        { "Mcp-Protocol-Version": "2025-06-18" },
      ),
    );
    const text = await response.text();
    const data = JSON.parse(
      text
        .split("\n")
        .find(l => l.startsWith("data: "))!
        .slice(6),
    );
    expect(data.result.tools.map((t: { name: string }) => t.name)).toEqual(TOOLS);
  });

  it("is 406 as a JSON-RPC error when the client does not accept both media types", async () => {
    const response = await handleMcpRequest(
      new Request("https://api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(406);
    expect(await response.json()).toMatchObject({
      jsonrpc: "2.0",
      error: { code: -32000 },
      id: null,
    });
  });

  it("opens the standalone SSE stream on GET and acknowledges DELETE", async () => {
    const get = await handleMcpRequest(
      new Request("https://api/mcp", { headers: { Accept: "text/event-stream" } }),
    );
    expect(get.status).toBe(200);
    expect(get.headers.get("content-type")).toMatch(/^text\/event-stream/);
    await get.body?.cancel();
    const del = await handleMcpRequest(new Request("https://api/mcp", { method: "DELETE" }));
    expect(del.status).toBe(200);
    expect(del.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
