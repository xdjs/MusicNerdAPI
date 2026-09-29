import { describe, it, expect, vi } from "vitest";

const { handler } = vi.hoisted(() => ({ handler: vi.fn() }));
vi.mock("@/lib/research/postResearchRefreshHandler", () => ({
  postResearchRefreshHandler: handler,
}));
const { POST, OPTIONS } = await import("@/app/api/artist/[id]/research/refresh/route");

describe("/api/artist/[id]/research/refresh", () => {
  it("answers the CORS preflight", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });

  it("hands POST to the handler with the artist id", async () => {
    handler.mockResolvedValueOnce(new Response("ok"));
    const req = new Request("https://api/x", { method: "POST" });
    await POST(req, { params: Promise.resolve({ id: "a1" }) });
    expect(handler).toHaveBeenCalledWith(req, "a1");
  });
});
