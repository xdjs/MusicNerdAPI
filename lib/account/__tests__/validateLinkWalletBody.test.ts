import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateLinkWalletBody } from "@/lib/account/validateLinkWalletBody";

const request = (body: string) =>
  new Request("https://api.musicnerd.test/api/auth/link-wallet", { method: "POST", body });

describe("validateLinkWalletBody", () => {
  it("returns the wallet lower-cased", async () => {
    expect(
      await validateLinkWalletBody(
        request('{"walletAddress":"0xABCDEF1234567890ABCDEF1234567890ABCDEF12"}'),
      ),
    ).toEqual({ walletAddress: "0xabcdef1234567890abcdef1234567890abcdef12" });
  });

  it("rejects a body that isn't JSON", async () => {
    const result = await validateLinkWalletBody(request("not json{"));
    expect(result).toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) return;
    expect(result.status).toBe(400);
    expect(await result.json()).toEqual({ status: "error", error: "Invalid request body" });
    expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it.each(["{}", '{"walletAddress":"0x123"}', '{"walletAddress":42}', "null"])(
    "rejects a missing or malformed wallet: %s",
    async body => {
      const result = await validateLinkWalletBody(request(body));
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
      expect(await result.json()).toEqual({ status: "error", error: "Invalid wallet address" });
    },
  );
});
