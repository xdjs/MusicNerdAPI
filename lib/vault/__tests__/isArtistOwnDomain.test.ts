import { describe, it, expect } from "vitest";
import { isArtistOwnDomain } from "@/lib/vault/isArtistOwnDomain";

describe("isArtistOwnDomain", () => {
  it("accepts a registrable domain that is the artist's name, with an allowed suffix", () => {
    expect(isArtistOwnDomain("https://www.peterango.com/about", "Pete Rango")).toBe(true);
    expect(isArtistOwnDomain("https://peterangomusic.co.uk", "Pete Rango")).toBe(true);
    expect(isArtistOwnDomain("https://peterangoofficial.net", "Pete Rango")).toBe(true);
  });

  it("rejects a domain that merely contains the name", () => {
    expect(isArtistOwnDomain("https://peterango-fans.example", "Pete Rango")).toBe(false);
    expect(isArtistOwnDomain("https://theguardian.com/peterango", "Pete Rango")).toBe(false);
  });

  it("rejects the name as a subdomain of someone else's domain", () => {
    expect(isArtistOwnDomain("https://peterango.attacker.example", "Pete Rango")).toBe(false);
  });

  it("rejects names too short to be distinctive, and bad URLs", () => {
    expect(isArtistOwnDomain("https://dave.com", "Dave")).toBe(false);
    expect(isArtistOwnDomain("not a url", "Pete Rango")).toBe(false);
    expect(isArtistOwnDomain("https://localhost", "Pete Rango")).toBe(false);
  });
});
