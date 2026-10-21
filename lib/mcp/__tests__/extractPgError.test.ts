import { describe, it, expect } from "vitest";
import { extractPgError } from "@/lib/mcp/extractPgError";

describe("extractPgError", () => {
  it("reads the code and constraint from the error itself, from constraint_name or constraint", () => {
    expect(extractPgError({ code: "23505", constraint_name: "u1" })).toEqual({
      code: "23505",
      constraint: "u1",
    });
    expect(extractPgError({ code: "23505", constraint: "u2" })).toEqual({
      code: "23505",
      constraint: "u2",
    });
    expect(extractPgError({ code: "23505" })).toEqual({ code: "23505", constraint: "" });
  });

  it("falls back to the error's cause, as Drizzle wraps driver errors", () => {
    const err = Object.assign(new Error("wrapped"), {
      cause: { code: "23505", constraint_name: "u1" },
    });
    expect(extractPgError(err)).toEqual({ code: "23505", constraint: "u1" });
  });

  it("is null for anything without a string code", () => {
    expect(extractPgError(new Error("plain"))).toBeNull();
    expect(extractPgError({ code: 23505 })).toBeNull();
    expect(extractPgError(null)).toBeNull();
    expect(extractPgError("text")).toBeNull();
  });
});
