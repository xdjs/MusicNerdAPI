import { describe, expect, it } from "vitest";
import { buildClientRedirect } from "@/lib/oauth/buildClientRedirect";

describe("buildClientRedirect", () => {
  it("adds the parameters it is given and skips missing ones", () => {
    const url = new URL(
      buildClientRedirect("http://127.0.0.1:33418/callback", {
        code: "mn_code_x",
        state: null,
        iss: "https://api.musicnerd.net/api/oauth",
      }),
    );
    expect(url.origin + url.pathname).toBe("http://127.0.0.1:33418/callback");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      code: "mn_code_x",
      iss: "https://api.musicnerd.net/api/oauth",
    });
  });

  it("keeps the redirect URI's own query", () => {
    const url = new URL(buildClientRedirect("https://a.example/cb?x=1", { state: "s" }));
    expect(Object.fromEntries(url.searchParams)).toEqual({ x: "1", state: "s" });
  });
});
