import { describe, it, expect } from "vitest";
import { rankAccountCandidates } from "@/lib/vault/rankAccountCandidates";

const cand = (id: string) => ({
  siteName: "instagram",
  id,
  url: `https://instagram.com/${id}`,
  title: "",
  description: "",
});

describe("rankAccountCandidates", () => {
  it("puts a handle that IS the artist's name first and otherwise keeps the order", () => {
    const ranked = rankAccountCandidates(
      [cand("pherosistar"), cand("zzz"), cand("pharaoh.sistare")],
      "Pharaoh Sistare",
    );
    expect(ranked.map(c => c.id)).toEqual(["pharaoh.sistare", "pherosistar", "zzz"]);
  });
});
