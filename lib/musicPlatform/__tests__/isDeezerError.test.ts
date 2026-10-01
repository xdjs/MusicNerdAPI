import { describe, it, expect } from "vitest";
import { isDeezerError } from "@/lib/musicPlatform/isDeezerError";

describe("isDeezerError", () => {
  it("recognizes Deezer's in-body error object", () => {
    expect(isDeezerError({ error: { type: "DataException", message: "no data" } })).toBe(true);
    expect(isDeezerError({ id: 1 })).toBe(false);
    expect(isDeezerError(null)).toBe(false);
    expect(isDeezerError({ error: "string" })).toBe(false);
  });
});
