import { describe, expect, it } from "vitest";
import { legacyText } from "@/lib/legacyLookups/legacyText";

describe("legacyText", () => {
  it("answers plain text with the status and CORS", async () => {
    const r = legacyText("nope", 404);
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("nope");
    expect(r.headers.get("Content-Type")).toMatch(/^text\/plain/);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
