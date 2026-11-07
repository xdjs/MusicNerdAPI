import { expect, it } from "vitest";
import { getAttributionFamily } from "../getAttributionFamily";
// Exact frozen questions; no grading facts or selector choices are supplied.
const cases = [
  {
    question:
      "Using only the sources already saved on Willie Colón's Music Nerd page, what was the first album he made with Rubén Blades? Cite the sources you read. Do not search the web.",
    family: "first-earliest",
  },
  {
    question:
      "Which years did Dutchyyy use each artist alias, and which were used at the same time?",
    family: "alias-inventory",
  },
  {
    question: "What was the first album Cedar made with Vale?",
    family: "first-earliest",
  },
  {
    question: "Which names did Mara use, in which years, and what overlap is documented?",
    family: "alias-inventory",
  },
] as const;
it.each(cases)("routes frozen $family question without changing it", ({ question, family }) => {
  expect(getAttributionFamily(question)).toBe(family);
});
