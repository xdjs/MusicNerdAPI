import { describe, it, expect } from "vitest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

describe("getCorsHeaders", () => {
  it("allows any origin, the API's methods, and the auth headers", () => {
    expect(getCorsHeaders()).toEqual({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, x-api-key",
    });
  });
});
