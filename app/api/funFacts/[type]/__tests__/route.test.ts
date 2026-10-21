import { describe, it, expect, vi } from "vitest";

const { handler } = vi.hoisted(() => ({ handler: vi.fn() }));
vi.mock("@/lib/funFacts/getFunFactHandler", () => ({ getFunFactHandler: handler }));
const route = await import("@/app/api/funFacts/[type]/route");

describe("/api/funFacts/[type]", () => {
  it("answers the CORS preflight", async () => {
    const res = await route.OPTIONS();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("hands GET to the handler with the type", async () => {
    handler.mockResolvedValueOnce(new Response("ok"));
    const req = new Request("https://api/api/funFacts/lore?id=a1");
    await route.GET(req, { params: Promise.resolve({ type: "lore" }) });
    expect(handler).toHaveBeenCalledWith(req, "lore");
    expect(route.dynamic).toBe("force-dynamic");
  });
});
