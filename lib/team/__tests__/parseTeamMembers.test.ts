import { describe, expect, it } from "vitest";
import { parseTeamMembers } from "@/lib/team/parseTeamMembers";

describe("parseTeamMembers", () => {
  it("maps each lowercased email to its name", () => {
    const members = parseTeamMembers(" sweetman = A@Example.com ,cy=b@example.com");
    expect(members.get("a@example.com")).toBe("sweetman");
    expect(members.get("b@example.com")).toBe("cy");
  });

  it("skips pairs missing a name or an email", () => {
    expect(parseTeamMembers("=a@example.com,cy=,,pete").size).toBe(0);
  });

  it("is empty when the list is unset", () => {
    expect(parseTeamMembers(undefined).size).toBe(0);
  });
});
