import { describe, expect, it, vi } from "vitest";
import { artistId } from "./fixtures";

const mock = vi.hoisted(() => ({ handler: vi.fn(async () => new Response("{}")) }));
vi.mock("@/lib/knowledge/getArtistKnowledgeHandler", () => ({
  getArtistKnowledgeHandler: mock.handler,
}));
describe("knowledge route wiring", () => {
  it.each([
    ["brief", () => import("@/app/api/artist/[id]/knowledge/brief/route")],
    ["sources", () => import("@/app/api/artist/[id]/knowledge/sources/route")],
    ["search", () => import("@/app/api/artist/[id]/knowledge/search/route")],
    ["history", () => import("@/app/api/artist/[id]/knowledge/history/route")],
    ["research-status", () => import("@/app/api/artist/[id]/research/status/route")],
  ] as const)("wires %s GET and OPTIONS", async (operation, load) => {
    const route = await load();
    const request = new Request("https://example.org");
    await route.GET(request, { params: Promise.resolve({ id: artistId }) });
    expect(mock.handler).toHaveBeenCalledWith(request, artistId, operation);
    const options = await route.OPTIONS();
    expect(options.status).toBe(200);
    expect(options.headers.get("access-control-allow-headers")).toContain("Authorization");
  });
  it("passes the namespaced source identity separately from query input", async () => {
    const route = await import("@/app/api/artist/[id]/knowledge/sources/[sourceId]/route");
    const request = new Request("https://example.org");
    await route.GET(request, {
      params: Promise.resolve({ id: artistId, sourceId: `vault:${artistId}` }),
    });
    expect(mock.handler).toHaveBeenCalledWith(request, artistId, "read", `vault:${artistId}`);
    expect((await route.OPTIONS()).status).toBe(200);
  });
});
