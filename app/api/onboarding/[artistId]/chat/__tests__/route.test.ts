import { describe, it, expect, vi } from "vitest";

const { handler } = vi.hoisted(() => ({ handler: vi.fn() }));
vi.mock("@/lib/onboarding/postOnboardingChatHandler", () => ({
  postOnboardingChatHandler: handler,
}));
const route = await import("@/app/api/onboarding/[artistId]/chat/route");

describe("/api/onboarding/[artistId]/chat", () => {
  it("answers the CORS preflight", async () => {
    const res = await route.OPTIONS();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });

  it("hands POST to the handler with the artist id, within a 60 s function", async () => {
    handler.mockResolvedValueOnce(new Response("ok"));
    const req = new Request("https://api/x", { method: "POST" });
    await route.POST(req, { params: Promise.resolve({ artistId: "a1" }) });
    expect(handler).toHaveBeenCalledWith(req, "a1");
    expect(route.maxDuration).toBe(60);
  });
});
