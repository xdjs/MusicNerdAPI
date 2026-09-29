import { describe, it, expect } from "vitest";
import { sourceSearchQueries } from "@/lib/vault/sourceSearchQueries";

describe("sourceSearchQueries", () => {
  it("asks in exact phrases AND the way a person would type it, plus a credits lookup", () => {
    const queries = sourceSearchQueries("Grimes");
    expect(queries).toHaveLength(5);
    expect(queries.filter(q => q.includes('"Grimes"'))).toHaveLength(4);
    expect(queries).toContain("Grimes");
    expect(queries).toContain('"Grimes" discogs credits');
  });
});
