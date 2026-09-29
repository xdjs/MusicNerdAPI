import { describe, it, expect } from "vitest";
import { stripQuery } from "@/lib/sources/stripQuery";

describe("stripQuery", () => {
  it("drops the query and fragment, which are never part of a handle", () => {
    expect(stripQuery("https://instagram.com/p3t3rango?hl=en#x")).toBe(
      "https://instagram.com/p3t3rango",
    );
  });

  it("cuts at ? or # when the URL cannot be parsed", () => {
    expect(stripQuery("instagram.com/p3t3rango?hl=en")).toBe("instagram.com/p3t3rango");
  });
});
