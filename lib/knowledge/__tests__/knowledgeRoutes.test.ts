import { describe, expect, it, vi } from "vitest";
import { artistId } from "./fixtures";

const mock = vi.hoisted(() => ({
  handler: vi.fn(async () => new Response("{}")),
  post: vi.fn(async () => new Response("{}")),
  patch: vi.fn(async () => new Response("{}")),
  remove: vi.fn(async () => new Response("{}")),
  removeMany: vi.fn(async () => new Response("{}")),
}));
vi.mock("@/lib/knowledge/getArtistKnowledgeHandler", () => ({
  getArtistKnowledgeHandler: mock.handler,
}));
vi.mock("@/lib/vaultSources/postVaultSourceHandler", () => ({ postVaultSourceHandler: mock.post }));
vi.mock("@/lib/vaultSources/patchVaultSourceHandler", () => ({
  patchVaultSourceHandler: mock.patch,
}));
vi.mock("@/lib/vaultSources/deleteVaultSourceHandler", () => ({
  deleteVaultSourceHandler: mock.remove,
}));
vi.mock("@/lib/vaultSources/deleteVaultSourcesHandler", () => ({
  deleteVaultSourcesHandler: mock.removeMany,
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
  it("wires the sources writes to their handlers", async () => {
    const list = await import("@/app/api/artist/[id]/knowledge/sources/route");
    const one = await import("@/app/api/artist/[id]/knowledge/sources/[sourceId]/route");
    const request = new Request("https://example.org");
    const params = Promise.resolve({ id: artistId, sourceId: "s1" });
    await list.POST(request, { params });
    expect(mock.post).toHaveBeenCalledWith(request, artistId);
    await list.DELETE(request, { params });
    expect(mock.removeMany).toHaveBeenCalledWith(request, artistId);
    await one.PATCH(request, { params });
    expect(mock.patch).toHaveBeenCalledWith(request, artistId, "s1");
    await one.DELETE(request, { params });
    expect(mock.remove).toHaveBeenCalledWith(request, artistId, "s1");
  });
});
