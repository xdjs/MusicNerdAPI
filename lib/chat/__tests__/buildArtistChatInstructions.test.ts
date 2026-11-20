import { describe, expect, it } from "vitest";
import { buildArtistChatInstructions } from "@/lib/chat/buildArtistChatInstructions";

it("keeps the answer to what was asked, written only after the tools are done", () => {
  const text = buildArtistChatInstructions("Dutchyyy");
  expect(text).toMatch(/don't write any text until you have finished using tools/i);
  expect(text).toMatch(/answer only what was asked/i);
});

describe("instructions", () => {
  const text = buildArtistChatInstructions("Dutchyyy", new Date("2026-10-27T12:00:00Z"));

  it("scopes the chat to the artist and today, without the removed PDF tools", () => {
    expect(text).toContain("Dutchyyy");
    expect(text).toContain("2026-10-27");
    expect(text).toMatch(/untrusted/i);
    expect(text).not.toMatch(/searchPdfSources|readPdfSource|readNamedPdf/);
  });

  it("states the tool rules in order: search, read, list, every item, cite, firsts, weak, abstain, latest", () => {
    const rules = [
      /start every question with searchPassages/i,
      /readUnits only when a claim needs more than the passage/i,
      /omit locators to read a whole short document/i,
      /listDocuments for questions about every or all/i,
      /before saying something is absent/i,
      /asks for every item of a kind/i,
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

  it("reads a whole partly shown document of 40 units or fewer when every item of a kind is asked for", () => {
    expect(text).toMatch(
      /when a question asks for every item of a kind \(all names, all aliases, all releases, all years, a full list or timeline\) and a document shows only part of its units/i,
    );
    expect(text).toMatch(
      /read that whole document with readUnits \(omit locators\) before answering/i,
    );
    expect(text).toMatch(/as long as it has 40 units or fewer; cite the pages you used/i);
    expect(text).toContain(
      "cite the pages you used. A document named in expanded was already returned whole; do not read it again. Include items a document mentions elsewhere, including one-time or parenthetical uses, and say how the document labels them, for example documented once in a given year.",
    );
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

  it("attributes conflicts, keeps categories as documents label them, and cites the stating passage", () => {
    const sentences = [
      "When documents disagree, give each account with its own citation and say plainly that the documents disagree. Do not reconcile them, and do not explain the difference with a distinction no document states.",
      "Count something as one of the items asked for only when a document itself labels it that way; anything a document labels differently (a group, a collaborator, a guest credit) is left out, or named as what the document calls it.",
      "Cite the locator of the passage that states the claim, not another page of the same document; if you cannot point to the passage that states something, leave it out.",
      "A document's own summary or overview list is not the full list: go through every unit you were shown for other items the document labels the same way (for example a release credited 'as' another name, or 'under the alias'), and add each one with what the document says about it.",
      "Write an ordinary fact a document gives (where someone is from or calls home, their family and background, dates, names, releases, who played on what) as a plain statement followed by its citation. That includes what the artist says about their own life in an interview or a post, even as the answer to a question like where is home: write 'He is from Cali, specifically Siloé [2, ¶3]', not 'He says he is from Siloé' and not 'according to' the outlet; the citation already shows where it comes from.",
      "Name who says something only when documents disagree, or when it is an opinion, a figure the person reports about themselves (money, sales, audience numbers) or a claim about someone else.",
      "Facts about the artist's life (home, family, upbringing, dates) stay plain statements even when the artist is the only source. Quote the artist, or write 'in her words' or 'in his words', only for an opinion, a feeling, a reason or a figure they report. Never write a bare 'she says she is' or 'he says he is': it reads as doubt.",
    ];
    for (const sentence of sentences) {
      expect(text).toContain(sentence);
    }
  });
});
