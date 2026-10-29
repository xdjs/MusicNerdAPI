import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateKnowledgeDocCorrectionBody } from "@/lib/knowledgeDoc/validateKnowledgeDocCorrectionBody";

const errorOf = async (r: unknown) => {
  expect(r).toBeInstanceOf(NextResponse);
  const res = r as NextResponse;
  expect(res.status).toBe(400);
  return (await res.json()).error;
};

describe("validateKnowledgeDocCorrectionBody", () => {
  it("trims a wrong claim and drops any correction", () => {
    expect(
      validateKnowledgeDocCorrectionBody({ claim: "  A claim. ", kind: "wrong", correction: "x" }),
    ).toEqual({ claim: "A claim.", kind: "wrong", correction: null });
  });

  it("trims a fix and caps claim and correction lengths", () => {
    const r = validateKnowledgeDocCorrectionBody({
      claim: "c".repeat(1200),
      kind: "fix",
      correction: ` ${"f".repeat(2500)} `,
    });
    expect(r).toEqual({ claim: "c".repeat(1000), kind: "fix", correction: "f".repeat(2000) });
  });

  it("refuses a blank claim", async () => {
    expect(await errorOf(validateKnowledgeDocCorrectionBody({ claim: "  ", kind: "wrong" }))).toBe(
      "No claim given",
    );
  });

  it("refuses a fix with no wording", async () => {
    expect(
      await errorOf(
        validateKnowledgeDocCorrectionBody({ claim: "A.", kind: "fix", correction: " " }),
      ),
    ).toBe("Write your correction first");
    expect(await errorOf(validateKnowledgeDocCorrectionBody({ claim: "A.", kind: "fix" }))).toBe(
      "Write your correction first",
    );
  });

  it("refuses a body that isn't a correction", async () => {
    expect(await errorOf(validateKnowledgeDocCorrectionBody(null))).toBe("Invalid correction");
    expect(await errorOf(validateKnowledgeDocCorrectionBody({ claim: "A.", kind: "maybe" }))).toBe(
      "Invalid correction",
    );
    expect(await errorOf(validateKnowledgeDocCorrectionBody({ claim: 3, kind: "wrong" }))).toBe(
      "Invalid correction",
    );
  });
});
