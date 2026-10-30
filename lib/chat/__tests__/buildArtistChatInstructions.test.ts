import { expect, it } from "vitest";
import { buildArtistChatInstructions } from "@/lib/chat/buildArtistChatInstructions";

it("scopes the chat to the artist, its tools and [n] citations", () => {
  const text = buildArtistChatInstructions("Dutchyyy", new Date("2026-10-27T12:00:00Z"));
  expect(text).toContain("Dutchyyy");
  expect(text).toContain("2026-10-27");
  expect(text).toContain("searchSources");
  expect(text).toContain("readSource");
  expect(text).toContain("webSearch");
  expect(text).toContain("[n]");
  expect(text).toMatch(/untrusted/i);
});

it("restricts citations to the current turn, re-reading a source to cite it again", () => {
  const text = buildArtistChatInstructions("Dutchyyy");
  expect(text).toMatch(/numbers restart each turn/i);
  expect(text).toMatch(/only cite numbers a tool gave you in this turn/i);
  expect(text).toMatch(/earlier turn, call readSource again/i);
});

it("keeps the answer to what was asked, written only after the tools are done", () => {
  const text = buildArtistChatInstructions("Dutchyyy");
  expect(text).toMatch(/don't write any text until you have finished using tools/i);
  expect(text).toMatch(/answer only what was asked/i);
});

it("reads more sources before saying they don't answer", () => {
  const text = buildArtistChatInstructions("Dutchyyy");
  expect(text).toMatch(/read at least three sources/i);
});

it("states only what a read source says, without a sources list", () => {
  const text = buildArtistChatInstructions("Dutchyyy");
  expect(text).toMatch(/never state facts from searchSources snippets/i);
  expect(text).toMatch(/don't add a list of sources/i);
});
