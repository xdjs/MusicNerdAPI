import { describe, it, expect } from "vitest";
import { GET, OPTIONS } from "@/app/api/health/route";

describe("/api/health", () => {
  it("GET answers ok", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("OPTIONS answers the preflight with CORS headers and no body", async () => {
    const response = await OPTIONS();
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(await response.text()).toBe("");
  });
});
