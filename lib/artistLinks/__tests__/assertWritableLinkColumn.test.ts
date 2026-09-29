import { describe, it, expect } from "vitest";
import { assertWritableLinkColumn } from "@/lib/artistLinks/assertWritableLinkColumn";

describe("assertWritableLinkColumn", () => {
  it("allows the whitelisted link columns", () => {
    for (const c of [
      "instagram",
      "spotify",
      "deezer",
      "facebookID",
      "tiktokID",
      "discogs",
      "inprocess",
    ]) {
      expect(() => assertWritableLinkColumn(c)).not.toThrow();
    }
  });

  it("refuses wallets, system columns and empty names", () => {
    expect(() => assertWritableLinkColumn("wallets")).toThrow("dedicated array operations");
    expect(() => assertWritableLinkColumn("bio")).toThrow("Column not in writable whitelist: bio");
    expect(() => assertWritableLinkColumn("")).toThrow("Invalid column name");
  });
});
