import { describe, it, expect } from "vitest";
import { fetchFailureKind } from "@/lib/pages/fetchFailureKind";

describe("fetchFailureKind", () => {
  it("calls a missing hostname dns, an abort a timeout, and anything else network", () => {
    expect(fetchFailureKind(Object.assign(new Error("x"), { cause: { code: "ENOTFOUND" } }))).toBe(
      "dns",
    );
    expect(fetchFailureKind(Object.assign(new Error("x"), { cause: { code: "EAI_AGAIN" } }))).toBe(
      "dns",
    );
    expect(fetchFailureKind(Object.assign(new Error("x"), { name: "TimeoutError" }))).toBe(
      "timeout",
    );
    expect(fetchFailureKind(Object.assign(new Error("x"), { name: "AbortError" }))).toBe("timeout");
    expect(fetchFailureKind(new Error("reset"))).toBe("network");
    expect(fetchFailureKind(undefined)).toBe("network");
  });
});
