import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateOnboardingTurnBody } from "@/lib/onboarding/validateOnboardingTurnBody";

const req = (body: string) => new Request("https://api/x", { method: "POST", body });
const error = async (res: unknown) => {
  expect(res).toBeInstanceOf(NextResponse);
  const r = res as NextResponse;
  expect(r.status).toBe(400);
  expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
  return (await r.json()).error;
};

describe("validateOnboardingTurnBody", () => {
  it("passes a turn through untouched", async () => {
    const turn = { type: "vault_review", decisions: [], addedUrls: ["https://a"] };
    expect(await validateOnboardingTurnBody(req(JSON.stringify(turn)))).toEqual(turn);
  });

  it("400s a body that isn't JSON, and a turn without a string type", async () => {
    expect(await error(await validateOnboardingTurnBody(req("not json")))).toBe("Invalid body");
    expect(await error(await validateOnboardingTurnBody(req("{}")))).toBe("Invalid turn");
    expect(await error(await validateOnboardingTurnBody(req('{"type":3}')))).toBe("Invalid turn");
    expect(await error(await validateOnboardingTurnBody(req("null")))).toBe("Invalid turn");
  });

  it.each(["decisions", "addedLinks", "addedUrls"])("400s more than 100 %s", async key => {
    const body = JSON.stringify({ type: "x", [key]: Array.from({ length: 101 }, () => ({})) });
    expect(await error(await validateOnboardingTurnBody(req(body)))).toBe(
      "Too many items in one turn",
    );
    const ok = JSON.stringify({ type: "x", [key]: Array.from({ length: 100 }, () => ({})) });
    expect(await validateOnboardingTurnBody(req(ok))).not.toBeInstanceOf(NextResponse);
  });
});
