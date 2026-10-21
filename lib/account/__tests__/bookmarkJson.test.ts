import { describe, it, expect } from "vitest";
import { bookmarkJson } from "@/lib/account/bookmarkJson";

describe("bookmarkJson", () => {
  it("is private, uncached JSON with CORS", async () => {
    const res = bookmarkJson({ status: "ok" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Vary")).toBe("Authorization, X-Bookmark-Account");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(bookmarkJson({ status: "error", error: "x" }, 409).status).toBe(409);
  });
});
