import { describe, it, expect } from "vitest";
import { withCorsHeaders } from "@/lib/networking/withCorsHeaders";

describe("withCorsHeaders", () => {
  it("adds the CORS headers and keeps the status, text, body and other headers", async () => {
    const response = withCorsHeaders(
      new Response("body", {
        status: 202,
        statusText: "Accepted",
        headers: { "Content-Type": "text/plain", "X-Other": "1" },
      }),
    );
    expect(response.status).toBe(202);
    expect(response.statusText).toBe("Accepted");
    expect(await response.text()).toBe("body");
    expect(response.headers.get("Content-Type")).toBe("text/plain");
    expect(response.headers.get("X-Other")).toBe("1");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
      "GET, POST, PUT, DELETE, OPTIONS, PATCH",
    );
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });

  it("works for a response without a body", () => {
    const response = withCorsHeaders(new Response(null, { status: 200 }));
    expect(response.body).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
