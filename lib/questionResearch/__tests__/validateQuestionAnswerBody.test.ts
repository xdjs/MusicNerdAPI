import { expect, it } from "vitest";
import { NextResponse } from "next/server";
import { validateQuestionAnswerBody } from "@/lib/questionResearch/validateQuestionAnswerBody";
const post = (body: string) => new Request("https://api.example", { method: "POST", body });
it("returns only the bounded question", async () => {
  expect(
    await validateQuestionAnswerBody(post(JSON.stringify({ question: "Who played drums?" }))),
  ).toEqual({
    question: "Who played drums?",
  });
});
it.each([
  "x".repeat(18001),
  "{not json",
  JSON.stringify({ question: "" }),
  JSON.stringify({ question: "q", artistId: "11111111-1111-4111-8111-111111111111" }),
])("answers 400 Invalid question for oversized, malformed or widened bodies: %#", async body => {
  const result = await validateQuestionAnswerBody(post(body));
  expect(result).toBeInstanceOf(NextResponse);
  expect((result as NextResponse).status).toBe(400);
  expect(await (result as NextResponse).json()).toEqual({
    status: "error",
    error: "Invalid question",
  });
});
