import { describe, it, expect, vi } from "vitest";

const { handler } = vi.hoisted(() => ({ handler: vi.fn() }));
vi.mock("@/lib/vaultUpload/postCompleteUploadHandler", () => ({
  postCompleteUploadHandler: handler,
}));
const route = await import("@/app/api/vault/upload/complete/route");

describe("/api/vault/upload/complete", () => {
  it("is dynamic, keeps Web's 60-second budget and answers the CORS preflight", async () => {
    expect(route.dynamic).toBe("force-dynamic");
    expect(route.maxDuration).toBe(60);
    const res = await route.OPTIONS();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });

  it("hands POST to the handler", async () => {
    handler.mockResolvedValueOnce(new Response("ok"));
    const req = new Request("https://api/x", { method: "POST" });
    await route.POST(req);
    expect(handler).toHaveBeenCalledWith(req);
  });
});
