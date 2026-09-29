import { describe, it, expect } from "vitest";
import { handleEchoesArtistName } from "@/lib/discovery/handleEchoesArtistName";

describe("handleEchoesArtistName", () => {
  it("accepts a handle containing the name, either direction, leetspeak included", () => {
    expect(handleEchoesArtistName("peterangomusic", "Pete Rango")).toBe(true);
    expect(handleEchoesArtistName("p3t3rango", "Pete Rango")).toBe(true);
    expect(handleEchoesArtistName("shumov", "Ivan Shumov")).toBe(true);
  });

  it("rejects a handle with no relation to the name, and an empty name", () => {
    expect(handleEchoesArtistName("inoise", "Shumov")).toBe(false);
    expect(handleEchoesArtistName("anything", "!!!")).toBe(false);
  });
});
