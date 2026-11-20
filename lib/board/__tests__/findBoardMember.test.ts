import { afterEach, describe, expect, it, vi } from "vitest";
import { findBoardMember } from "@/lib/board/findBoardMember";

afterEach(() => vi.unstubAllEnvs());

describe("findBoardMember", () => {
  it("names the member an email belongs to, ignoring case", () => {
    vi.stubEnv("BOARD_ALLOWED_EMAILS", "sweetman=a@example.com");
    expect(findBoardMember("A@example.com")).toBe("sweetman");
  });

  it("is null for an email off the team", () => {
    vi.stubEnv("BOARD_ALLOWED_EMAILS", "sweetman=a@example.com");
    expect(findBoardMember("b@example.com")).toBeNull();
  });
});
