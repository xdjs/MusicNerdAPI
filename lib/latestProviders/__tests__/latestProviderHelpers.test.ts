import { expect, it } from "vitest";
import { latestProviderAccount } from "../latestProviderAccount";
import { latestActivityTime } from "../latestActivityTime";
it("accepts known provider IDs and canonicalizes InProcess accounts", () => {
  expect(latestProviderAccount("spotify", "https://evil.example")).toBeNull();
  expect(latestProviderAccount("deezer", "123")).toBe("123");
  expect(
    latestProviderAccount("inprocess", `https://www.inprocess.world/0x${"A".repeat(40)}`),
  ).toBe(`0x${"a".repeat(40)}`);
});
it("orders partial dates at their period end and rejects impossible dates", () => {
  expect(latestActivityTime("2025")).toBe(Date.parse("2025-12-31T23:59:59.999Z"));
  expect(latestActivityTime("2026-02")).toBe(Date.parse("2026-02-28T23:59:59.999Z"));
  expect(Number.isNaN(latestActivityTime("2026-02-30"))).toBe(true);
  expect(Number.isNaN(latestActivityTime("2026-13"))).toBe(true);
});
