import { describe, it, expect } from "vitest";
import { deleetHandle } from "@/lib/discovery/deleetHandle";

describe("deleetHandle", () => {
  it("undoes common digit-for-letter swaps", () => {
    expect(deleetHandle("p3t3rango")).toBe("peterango");
    expect(deleetHandle("0145 7")).toBe("oias t");
  });
});
