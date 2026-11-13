import { describe, expect, test } from "vitest";
import { expandSearchQueries } from "@/lib/units/expandSearchQueries";

describe("expandSearchQueries", () => {
  test("expandSearchQueries adds the artist name once", () => {
    expect(expandSearchQueries("when was the first tour", ["Mike Dean", "MD"])).toEqual([
      "when was the first tour",
      "when was the first tour Mike Dean",
    ]);
  });

  test("leaves a question that already names the artist, by any of its names", () => {
    expect(expandSearchQueries("what did mike dean say", ["Mike Dean"])).toEqual([
      "what did mike dean say",
    ]);
    expect(expandSearchQueries("what did MD say", ["Mike Dean", "md"])).toEqual([
      "what did MD say",
    ]);
  });

  test("adds nothing without a usable first name", () => {
    expect(expandSearchQueries("first tour", [])).toEqual(["first tour"]);
    expect(expandSearchQueries("first tour", ["  "])).toEqual(["first tour"]);
  });
});
