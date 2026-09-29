import { describe, it, expect } from "vitest";
import { classifyFetchedSource } from "@/lib/sources/classifyFetchedSource";
import type { PageContent } from "@/lib/pages/types";

const body = (text: string) =>
  `Pete Rango ${text} ${"filler sentence about the record. ".repeat(20)}`;
const page = (p: Partial<PageContent>): PageContent => ({
  title: "t",
  extractedText: body("produced it."),
  status: 200,
  ...p,
});

describe("classifyFetchedSource", () => {
  it("treats only a nonexistent hostname as dead when the request never completed", () => {
    expect(classifyFetchedSource(page({ status: null, failure: "dns" }), "Pete Rango")).toBe(
      "dead",
    );
    expect(classifyFetchedSource(page({ status: null, failure: "timeout" }), "Pete Rango")).toBe(
      "lead",
    );
    expect(classifyFetchedSource(page({ status: null, failure: "network" }), "Pete Rango")).toBe(
      "lead",
    );
  });

  it("reads 404 and 410 as dead, and other non-2xx as a lead", () => {
    expect(classifyFetchedSource(page({ status: 404 }), "Pete Rango")).toBe("dead");
    expect(classifyFetchedSource(page({ status: 410 }), "Pete Rango")).toBe("dead");
    expect(classifyFetchedSource(page({ status: 403 }), "Pete Rango")).toBe("lead");
    expect(classifyFetchedSource(page({ status: 503 }), "Pete Rango")).toBe("lead");
  });

  it("keeps a page with too little text as a lead", () => {
    expect(classifyFetchedSource(page({ extractedText: "Pete Rango" }), "Pete Rango")).toBe("lead");
    expect(classifyFetchedSource(page({ extractedText: null }), "Pete Rango")).toBe("lead");
  });

  it("calls a parked domain or soft-404 dead, reading the full text", () => {
    expect(
      classifyFetchedSource(
        page({ extractedText: body("x"), fullText: body("x") + " This domain is registered" }),
        "Pete Rango",
      ),
    ).toBe("dead");
  });

  it("verifies a readable page that names the artist, reading past the storage cap", () => {
    expect(classifyFetchedSource(page({}), "Pete Rango")).toBe("verified");
    const late = "unrelated words. ".repeat(40);
    expect(
      classifyFetchedSource(
        page({ extractedText: late, fullText: late + "Pete Rango" }),
        "Pete Rango",
      ),
    ).toBe("verified");
  });

  it("keeps a page that doesn't name the artist as a lead, unless identity was confirmed", () => {
    const other = "Somebody else entirely. ".repeat(30);
    expect(classifyFetchedSource(page({ extractedText: other }), "Pete Rango")).toBe("lead");
    expect(
      classifyFetchedSource(page({ extractedText: other }), "Pete Rango", {
        identityConfirmed: true,
      }),
    ).toBe("verified");
  });

  it("applies the full-name rule when asked", () => {
    const partial = "RANGO wordmark. ".repeat(40);
    expect(classifyFetchedSource(page({ extractedText: partial }), "Pete Rango")).toBe("verified");
    expect(
      classifyFetchedSource(page({ extractedText: partial }), "Pete Rango", {
        requireFullName: true,
      }),
    ).toBe("lead");
  });
});
