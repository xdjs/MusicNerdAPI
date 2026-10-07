import { describe, expect, it } from "vitest";
import { validateInterviewResponseRequest } from "../validateInterviewResponseRequest";
import { validateInterviewResponseBody } from "../validateInterviewResponseBody";
import { artistId, answer } from "@/lib/knowledge/__tests__/fixtures";

describe("interview response input", () => {
  it("accepts bounded list/read/version operations and rejects unexpected or duplicate parameters", () => {
    expect(
      validateInterviewResponseRequest(
        new Request("https://example.org?limit=5"),
        artistId,
        "list",
      ),
    ).toEqual({ limit: 5 });
    for (const query of [
      "limit=0",
      "limit=21",
      "limit=2&limit=3",
      "accountId=another",
      "revision=" + "a".repeat(64),
    ]) {
      expect(() =>
        validateInterviewResponseRequest(
          new Request("https://example.org?" + query),
          artistId,
          "list",
        ),
      ).toThrow();
    }
    expect(() =>
      validateInterviewResponseRequest(new Request("https://example.org"), "bad-id", "list"),
    ).toThrow();
    expect(
      validateInterviewResponseRequest(
        new Request("https://example.org?revision=" + "a".repeat(64)),
        artistId,
        "read",
        answer.id,
      ),
    ).toEqual({ revision: "a".repeat(64) });
    expect(() =>
      validateInterviewResponseRequest(
        new Request("https://example.org?limit=5"),
        artistId,
        "revise",
        answer.id,
      ),
    ).toThrow();
  });
  it("requires a concurrency token and exact nonblank words without accepting forged identity", () => {
    const body = {
      expectedRevision: "b".repeat(64),
      answer: "  Kept the pauses.\nOnly on this track. ",
    };
    expect(validateInterviewResponseBody(body)).toEqual({ ...body, note: "" });
    for (const invalid of [
      { ...body, answer: " " },
      { ...body, answer: "x".repeat(2001) },
      { ...body, note: "x".repeat(401) },
      { ...body, expectedRevision: "old" },
      { ...body, artistId },
      { ...body, userId: "forged" },
      { ...body, question: "replace question" },
    ]) {
      expect(() => validateInterviewResponseBody(invalid)).toThrow();
    }
  });
});
