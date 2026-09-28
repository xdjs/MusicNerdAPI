import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/research/postResearchAdvanceHandler", () => ({
  postResearchAdvanceHandler: async () => Response.json({ status: "ok", via: "post" }),
}));
vi.mock("@/lib/research/getResearchAdvanceHandler", () => ({
  getResearchAdvanceHandler: async () => Response.json({ status: "ok", via: "get" }),
}));
const route = await import("@/app/api/research/advance/route");

describe("/api/research/advance", () => {
  it("gets the whole 60 s allowance and is never cached", () => {
    expect(route.maxDuration).toBe(60);
    expect(route.dynamic).toBe("force-dynamic");
  });

  it("delegates POST and GET to their handlers", async () => {
    const req = new Request("http://x/api/research/advance");
    expect(await (await route.POST(req)).json()).toEqual({ status: "ok", via: "post" });
    expect(await (await route.GET(req)).json()).toEqual({ status: "ok", via: "get" });
  });

  it("answers the CORS preflight", async () => {
    const response = await route.OPTIONS();
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});
