import { describe, it, expect, vi } from "vitest";

const { handler } = vi.hoisted(() => ({ handler: vi.fn() }));
vi.mock("@/lib/vaultUpload/postSignUploadHandler", () => ({ postSignUploadHandler: handler }));
const route = await import("@/app/api/vault/upload/sign/route");

describe("/api/vault/upload/sign", () => {
  it("is dynamic and answers the CORS preflight", async () => {
    expect(route.dynamic).toBe("force-dynamic");
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
