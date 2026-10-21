import { describe, expect, it } from "vitest";
import { getUserDisplayName } from "@/lib/users/getUserDisplayName";

describe("getUserDisplayName", () => {
  it("returns the trimmed chosen name", () => {
    expect(getUserDisplayName({ username: " Aux Bandit " })).toBe("Aux Bandit");
  });

  it("returns Anonymous while a name is still pending", () => {
    expect(getUserDisplayName({ username: "private@example.test" })).toBe("Anonymous");
    expect(getUserDisplayName({ username: null, wallet: "0xabc" })).toBe("Anonymous");
  });
});
