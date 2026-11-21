import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/db", () => ({ db: {} }));
const consent = await import("@/app/api/oauth/consent/route");
const connections = await import("@/app/api/oauth/connections/route");
const connection = await import("@/app/api/oauth/connections/[id]/route");
const reg = await import("@/app/api/oauth/reg/route");
const token = await import("@/app/api/oauth/token/route");

describe("OAuth routes the Web pages and agents call cross-origin", () => {
  it.each([
    ["consent", consent.OPTIONS, "POST"],
    ["connections", connections.OPTIONS, "GET"],
    ["connections/{id}", connection.OPTIONS, "DELETE"],
    ["reg", reg.OPTIONS, "POST"],
    ["token", token.OPTIONS, "POST"],
  ])(
    "%s answers the preflight, allowing %s and the Authorization header",
    async (_n, options, method) => {
      const res = await options();
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain(method);
      expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    },
  );

  it("serves the documented methods on each path", () => {
    const methods = (route: object) =>
      Object.keys(route)
        .filter(k => k !== "dynamic")
        .sort();
    expect(methods(consent)).toEqual(["GET", "OPTIONS", "POST"]);
    expect(methods(connections)).toEqual(["GET", "OPTIONS"]);
    expect(methods(connection)).toEqual(["DELETE", "OPTIONS"]);
  });
});
