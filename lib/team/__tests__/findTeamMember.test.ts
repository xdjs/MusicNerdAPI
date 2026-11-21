import { afterEach, describe, expect, it, vi } from "vitest";
import { findTeamMember } from "@/lib/team/findTeamMember";

afterEach(() => vi.unstubAllEnvs());

describe("findTeamMember", () => {
  it("names the member an email belongs to, ignoring case", () => {
    vi.stubEnv("TEAM_ALLOWED_EMAILS", "sweetman=a@example.com");
    expect(findTeamMember("A@example.com")).toBe("sweetman");
  });

  it("is null for an email off the team", () => {
    vi.stubEnv("TEAM_ALLOWED_EMAILS", "sweetman=a@example.com");
    expect(findTeamMember("b@example.com")).toBeNull();
  });
});
