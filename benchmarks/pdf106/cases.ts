/** Frozen diagnostic cases: first/repeated is not a guarantee of provider cache state. */
export const ORIGINAL_CASES = [
  {
    key: "normal-origin",
    artistId: "aab92f80-f9e1-4299-aa33-7dd85c8de5d3",
    artistName: "Bio Ritmo",
    question: "Where is Bio Ritmo from and when did the band start?",
  },
  {
    key: "normal-singer",
    artistId: "aab92f80-f9e1-4299-aa33-7dd85c8de5d3",
    artistName: "Bio Ritmo",
    question: "Who sings lead in Bio Ritmo?",
  },
  {
    key: "pdf-timeline",
    artistId: "6cb3d81a-3d02-4c57-a711-bb7902a9af1b",
    artistName: "Dutchyyy",
    question:
      "In your saved dutch_discography_timeline.pdf, under what alias did Dutch appear on Nowledge Of Self's 2001 We're Here Now, and what catalog number is listed? Please cite the PDF.",
  },
  {
    key: "pdf-preface",
    artistId: "6cb3d81a-3d02-4c57-a711-bb7902a9af1b",
    artistName: "Dutchyyy",
    question:
      "In the preface of your saved Dutchyyy VS The Algorithms (short) PDF, what does Dutch say he wants to preserve when platforms disappear? Does he state this as a guarantee or qualify it? Please cite the PDF.",
  },
] as const;
export const BASELINE = "e4054a4783ab3cf7dfdadf91d7285a54adf3c734";

export const SMOKE_CASES = [
  {
    key: "pdf-smoke-artist",
    artistId: "50f23458-df64-4381-8042-7333e8b64531",
    artistName: "Pete Rango",
    question:
      "Read the original saved 1618-pete-rango-pdf-extraction-test.pdf. What artist name is written inside it? Cite the original PDF and physical page if supported. Do not substitute profile biography or infer the answer from the filename.",
  },
  {
    key: "pdf-smoke-label",
    artistId: "50f23458-df64-4381-8042-7333e8b64531",
    artistName: "Pete Rango",
    question:
      "Read the original saved 1618-pete-rango-pdf-extraction-test.pdf. What exact test label, including issue number, is written inside it? Cite the original PDF and physical page if supported. If you cannot read it, say so rather than infer the text from its filename.",
  },
] as const;
export const SMOKE = process.env.PDF106_MODE === "pete-smoke";
export const CASES = SMOKE ? SMOKE_CASES : ORIGINAL_CASES;
export const PRIOR_ATTEMPTS = ORIGINAL_CASES.filter(c => c.key.startsWith("normal"))
  .flatMap(c => ["first", "repeated"].map(r => `baseline:${c.key}:${r}`))
  .concat(
    ORIGINAL_CASES.filter(c => c.key.startsWith("normal")).flatMap(c =>
      ["first", "repeated"].map(r => `candidate:${c.key}:${r}`),
    ),
  );
