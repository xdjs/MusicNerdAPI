import { expect, it } from "vitest";
import { getAttributionFamily } from "../getAttributionFamily";

it.each([
  "List all her aliases.",
  "Give me all artist names.",
  "Please show their recording names.",
  "List the musician's pseudonyms.",
])("routes imperative alias inventories: %s", question => {
  expect(getAttributionFamily(question)).toBe("alias-inventory");
});

it.each([
  "What were their earliest releases?",
  "Which were their first albums?",
  "What were their debut singles?",
  "Which were their earliest EPs?",
])("routes plural release nouns: %s", question => {
  expect(getAttributionFamily(question)).toBe("first-earliest");
});

it("resolves name chronology only in an active alias inventory", () => {
  const question = "Which name came first?";
  expect(getAttributionFamily(question, ["List all her aliases."])).toBe("alias-inventory");
  expect(getAttributionFamily(question)).toBeNull();
  expect(getAttributionFamily(question, ["What was their first album?"])).toBeNull();
  expect(
    getAttributionFamily(question, ["List all her aliases.", "What instrument do they play?"]),
  ).toBeNull();
});

it.each([
  "List all variable names.",
  "Give me all artist names on the calendar.",
  "Show the database aliases.",
  "Rewrite the sentence listing her aliases.",
  "What were their earliest festival dates?",
  "What were their earliest work shifts?",
  "List all her instruments.",
  "The aliases are interesting.",
])("keeps unrelated requests outside both families: %s", question => {
  expect(getAttributionFamily(question)).toBeNull();
  expect(getAttributionFamily(question, ["Which stage names were used?"])).toBeNull();
});
