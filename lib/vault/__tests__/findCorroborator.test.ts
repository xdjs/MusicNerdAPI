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
});
