import { describe, it, expect } from "vitest";
import { findCorroborator } from "@/lib/vault/findCorroborator";

describe("findCorroborator", () => {
  it("finds a link to an id we already hold, normalizing an @-prefixed stored value", () => {
    const resolved = [
      { siteName: "instagram", id: "rvamag" },
      { siteName: "bandcamp", id: "dupes" },
    ];
    expect(findCorroborator(resolved, { bandcamp: "@Dupes" })).toEqual({
      siteName: "bandcamp",
      id: "dupes",
    });
  });

  it("is undefined when nothing matches what we hold", () => {
    expect(
      findCorroborator([{ siteName: "instagram", id: "rvamag" }], { instagram: "dupesdidit" }),
    ).toBeUndefined();
    expect(findCorroborator([{ siteName: "x", id: "a" }], {})).toBeUndefined();
  });

  it("skips an id that is only a discovery guess, so a namesake can't vouch for a page", () => {
    const resolved = [
      { siteName: "youtube", id: "bioritmo" },
      { siteName: "instagram", id: "bioritmo.oficial" },
    ];
    expect(
      findCorroborator(resolved, { youtube: "bioritmo" }, new Set(["youtube"])),
    ).toBeUndefined();
  });

  it("still corroborates through a held id when another column is provisional", () => {
    const resolved = [{ siteName: "deezer", id: "416544" }];
    expect(
      findCorroborator(resolved, { deezer: "416544", youtube: "bioritmo" }, new Set(["youtube"])),
    ).toEqual({ siteName: "deezer", id: "416544" });
  });
});
