import { describe, expect, it } from "vitest";
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

it("treats approved PDFs as a corpus for ordinary questions, not only PDF questions", () => {
  const text = buildArtistChatInstructions("Dutchyyy");
  expect(text).toMatch(/searchPdfSources searches approved Lore PDFs/i);
  expect(text).toMatch(/even for ordinary artist questions that do not mention PDFs/i);
  expect(text).toMatch(/before concluding saved evidence is absent/i);
});

it("asks for a whole-source scan when every item of a kind is requested", () => {
  const text = buildArtistChatInstructions("Dutchyyy");
  expect(text).toMatch(/every item of a kind/i);
  expect(text).toMatch(/not only its summary or overview list/i);
  expect(text).toMatch(/say how the source labels them/i);
});

it("starts every question with saved-source and PDF discovery together", () => {
  const text = buildArtistChatInstructions("Dutchyyy");
  expect(text).toMatch(
    /start every question by calling searchSources and searchPdfSources together/i,
  );
});

it("reads a second source for firsts and dates and reports disagreement", () => {
  const text = buildArtistChatInstructions("Dutchyyy");
  expect(text).toMatch(/first, earliest or when something happened/i);
  expect(text).toMatch(/read at least two sources/i);
  expect(text).toMatch(/report the disagreement instead of picking one/i);
});

it("keeps the legacy text when no mode or legacy is given", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  expect(buildArtistChatInstructions("Dutchyyy", now, "legacy")).toBe(
    buildArtistChatInstructions("Dutchyyy", now),
  );
});

describe("units mode", () => {
  const text = buildArtistChatInstructions("Dutchyyy", new Date("2026-10-27T12:00:00Z"), "units");

  it("scopes the chat to the artist and today, without the PDF tools", () => {
    expect(text).toContain("Dutchyyy");
    expect(text).toContain("2026-10-27");
    expect(text).toMatch(/untrusted/i);
    expect(text).not.toMatch(/searchPdfSources|readPdfSource|readNamedPdf/);
  });

  it("states the tool rules in order: search, read, list, cite, firsts, weak, abstain, latest", () => {
    const rules = [
      /start every question with searchPassages/i,
      /readUnits only when a claim needs more than the passage/i,
      /omit locators to read a whole short document/i,
      /listDocuments for questions about every or all/i,
      /before saying something is absent/i,
      /\[n, p\.N\]/,
      /\[n, §Heading\] or \[n, ¶N\]/,
      /first, earliest or when/i,
      /weak/,
      /read the passages: if they do not contain the answer/i,
      /retrieval: "latest"/,
    ].map(rule => text.search(rule));
    expect(rules.every(at => at >= 0)).toBe(true);
    expect([...rules].sort((a, b) => a - b)).toEqual(rules);
  });

  it("takes citation numbers only from the tools, including numbers from earlier turns", () => {
    expect(text).toMatch(/only numbers the tools gave you/i);
    expect(text).toMatch(/number from an earlier answer in this conversation/i);
    expect(text).not.toMatch(/numbers restart each turn/i);
  });

  it("carries only document numbers across turns; web and readSource results are fetched again", () => {
    expect(text).toMatch(
      /only numbers from searchPassages, readUnits or listDocuments carry across turns/i,
    );
    expect(text).toMatch(
      /a webSearch, searchSources or readSource result from an earlier answer must be fetched again in this turn before you cite it/i,
    );
    expect(text).not.toMatch(/so you may cite it again; never invent one/);
  });

  it("reads two documents for firsts and dates and reports disagreement", () => {
    expect(text).toMatch(/read at least two documents/i);
    expect(text).toMatch(/report the disagreement instead of picking one/i);
  });

  it("abstains from what the passages say, not from weak alone", () => {
    expect(text).toMatch(
      /read the passages: if they do not contain the answer and webSearch does not either, say plainly that the saved sources do not cover it/i,
    );
    expect(text).toMatch(/treat weak: true only as an early sign of that/i);
    expect(text).not.toMatch(/weak: true and webSearch cannot answer either/i);
  });

  it("keeps searchSources with retrieval latest for current releases only", () => {
    expect(text).toMatch(/searchSources with retrieval: "latest".*current releases only/i);
  });

  it("states the exact locator forms readUnits matches", () => {
    expect(text).toMatch(/locators exactly as searchPassages gave them.*p\.4.*§Heading.*¶3/i);
  });
});
