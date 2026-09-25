import { describe, it, expect } from "vitest";
import { getHealthHandler } from "@/lib/health/getHealthHandler";

describe("getHealthHandler", () => {
  it("returns 200 with a flat status body", async () => {
    const response = getHealthHandler();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("carries the CORS headers", () => {
    expect(getHealthHandler().headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
