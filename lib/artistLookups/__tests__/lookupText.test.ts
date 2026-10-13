import { describe, expect, it } from "vitest";
import { lookupText } from "@/lib/artistLookups/lookupText";

describe("lookupText", () => {
  it("answers plain text with the status and CORS", async () => {
    const r = lookupText("nope", 404);
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("nope");
    expect(r.headers.get("Content-Type")).toMatch(/^text\/plain/);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
