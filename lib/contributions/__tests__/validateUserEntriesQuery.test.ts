import { describe, expect, it } from "vitest";
import { validateUserEntriesQuery } from "@/lib/contributions/validateUserEntriesQuery";

const at = (suffix = "") => new Request(`https://example.org/api/userEntries${suffix}`);

describe("validateUserEntriesQuery", () => {
  it("defaults every parameter", () => {
    expect(validateUserEntriesQuery(at())).toEqual({
      page: 1,
      siteName: null,
      all: false,
      status: null,
      query: undefined,
      order: "newest",
    });
  });

  it("reads the filters as the website did", () => {
    expect(
      validateUserEntriesQuery(
        at("?page=2&siteName=bandcamp&status=approved&query=%20ritmo%20&order=oldest&all=true"),
      ),
    ).toEqual({
      page: 2,
      siteName: "bandcamp",
      all: true,
      status: "approved",
      query: "ritmo",
      order: "oldest",
    });
    expect(validateUserEntriesQuery(at("?status=pending"))).toMatchObject({ status: "pending" });
  });

  it("falls back on bad values instead of rejecting: page, siteName=all, unknown status/order, all=yes, empty query", () => {
    expect(validateUserEntriesQuery(at("?page=0"))).toMatchObject({ page: 1 });
    expect(validateUserEntriesQuery(at("?page=abc"))).toMatchObject({ page: 1 });
    expect(validateUserEntriesQuery(at("?page=2.9"))).toMatchObject({ page: 2 });
    expect(validateUserEntriesQuery(at("?siteName=all"))).toMatchObject({ siteName: null });
    expect(validateUserEntriesQuery(at("?siteName="))).toMatchObject({ siteName: null });
    expect(validateUserEntriesQuery(at("?status=rejected&order=random&all=yes"))).toMatchObject({
      status: null,
      order: "newest",
      all: false,
    });
    expect(validateUserEntriesQuery(at("?query=%20%20"))).toMatchObject({ query: undefined });
    expect(validateUserEntriesQuery(at(`?query=${"a".repeat(120)}`)).query).toHaveLength(100);
  });
});
