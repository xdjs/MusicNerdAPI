import { describe, expect, it } from "vitest";
import { parseBoardMembers } from "@/lib/board/parseBoardMembers";

describe("parseBoardMembers", () => {
  it("maps each lowercased email to its name", () => {
    const members = parseBoardMembers(" sweetman = A@Example.com ,cy=b@example.com");
    expect(members.get("a@example.com")).toBe("sweetman");
    expect(members.get("b@example.com")).toBe("cy");
  });

  it("skips pairs missing a name or an email", () => {
    expect(parseBoardMembers("=a@example.com,cy=,,pete").size).toBe(0);
  });

  it("is empty when the list is unset", () => {
    expect(parseBoardMembers(undefined).size).toBe(0);
  });
});
