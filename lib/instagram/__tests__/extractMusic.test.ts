import { describe, it, expect } from "vitest";
import { extractMusic } from "@/lib/instagram/extractMusic";

const none = { musicTitle: null, musicArtist: null };
const info = (artist_name: unknown, song_name: unknown, uses_original_audio = false) => ({
  musicInfo: { artist_name, song_name, uses_original_audio },
});

describe("extractMusic", () => {
  it("keeps a real third-party credit", () => {
    expect(extractMusic(info("Brian Eno", "Signals"), "p3t3rango", "p3t3rango")).toEqual({
      musicTitle: "Signals",
      musicArtist: "Brian Eno",
    });
  });

  it("drops missing info, original audio and incomplete credits", () => {
    expect(extractMusic({}, "a", "a")).toEqual(none);
    expect(extractMusic(info("x", "Some Track", true), "a", "a")).toEqual(none);
    expect(extractMusic(info("x", "Original audio"), "a", "a")).toEqual(none);
    expect(extractMusic(info("", "Some Track"), "a", "a")).toEqual(none);
  });

  it("drops a credit naming the poster by handle, display name or real name", () => {
    expect(extractMusic(info("Pharaoh Sistare", "T"), "pharaohsistare", "pharaohsistare")).toEqual(
      none,
    );
    expect(
      extractMusic(info("Black Dave", "T"), "worstgeneration", "worstgeneration", "Black Dave"),
    ).toEqual(none);
  });
});
