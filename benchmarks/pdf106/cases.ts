/** Frozen diagnostic cases: first/repeated is not a guarantee of provider cache state. */
export const CASES = [
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
