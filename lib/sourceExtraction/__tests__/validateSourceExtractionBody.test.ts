import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateSourceExtractionBody } from "@/lib/sourceExtraction/validateSourceExtractionBody";
const id = "11111111-1111-4111-8111-111111111111";
const request = (body: unknown) =>
  new Request("https://api.example/extract", { method: "POST", body: JSON.stringify(body) });
describe("validateSourceExtractionBody", () => {
  it("accepts bounded explicit source selection", async () =>
    expect(await validateSourceExtractionBody(request({ sourceIds: [id] }))).toEqual({
      sourceIds: [id],
    }));
  it.each([
    { sourceIds: [] },
    { sourceIds: [id, id] },
    { sourceIds: ["invalid"] },
    { sourceIds: [id], accountId: id },
    { url: "https://example.com" },
    {},
  ])("rejects invalid input %j", async body =>
    expect(((await validateSourceExtractionBody(request(body))) as NextResponse).status).toBe(400),
  );
  it("rejects unreadable JSON rather than selecting everything", async () =>
    expect(
      (
        (await validateSourceExtractionBody(
          new Request("https://api.example", { method: "POST", body: "{" }),
        )) as NextResponse
      ).status,
    ).toBe(400));
});
