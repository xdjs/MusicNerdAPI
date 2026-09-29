import { describe, it, expect } from "vitest";
import { holdsAnswerFor } from "@/lib/vault/holdsAnswerFor";

describe("holdsAnswerFor", () => {
  it("is true for a set column that isn't provisional", () => {
    expect(holdsAnswerFor({ instagram: "pete" }, "instagram")).toBe(true);
  });

  it("treats a provisional guess, or an empty column, as still open", () => {
    expect(holdsAnswerFor({ instagram: "blackdavemk2" }, "instagram", new Set(["instagram"]))).toBe(
      false,
    );
    expect(holdsAnswerFor({ instagram: null }, "instagram")).toBe(false);
  });
});
