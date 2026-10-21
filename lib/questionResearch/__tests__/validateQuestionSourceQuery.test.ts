import { expect, it } from "vitest";
import { NextResponse } from "next/server";
import { validateQuestionSourceQuery } from "@/lib/questionResearch/validateQuestionSourceQuery";
const id = "11111111-1111-4111-8111-111111111111";
const sourceId = "social:33333333-3333-4333-8333-333333333333:caption";
const revision = "b".repeat(64);
const req = (query: string) => new Request(`https://api.example/x?${query}`);
it("parses sourceId, revision and start, defaulting start to 0", async () => {
  expect(validateQuestionSourceQuery(req(`sourceId=${sourceId}&revision=${revision}`), id)).toEqual(
    { sourceId, revision, start: 0 },
  );
  expect(
    validateQuestionSourceQuery(req(`sourceId=${sourceId}&revision=${revision}&start=12000`), id),
  ).toEqual({ sourceId, revision, start: 12000 });
});
it("returns Web's 400 for a start past 4,000,000 or a non-UUID artist", async () => {
  const over = validateQuestionSourceQuery(
    req(`sourceId=${sourceId}&revision=${revision}&start=4000001`),
    id,
  );
  expect(over).toBeInstanceOf(NextResponse);
  expect((over as NextResponse).status).toBe(400);
  const artist = validateQuestionSourceQuery(req(`sourceId=${sourceId}&revision=${revision}`), "x");
  expect(await (artist as NextResponse).json()).toEqual({
    status: "error",
    error: "Invalid source reference",
  });
});
