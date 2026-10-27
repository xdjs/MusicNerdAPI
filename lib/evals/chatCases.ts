/** One chat-suite question, hand-checked against the artist's stored approved sources. */
export type ChatCase = {
  key: string;
  artistName: string;
  /** STAGING artist id. The same artist has a different id on production. */
  artistId: string;
  question: string;
  /** False when the stored sources can't answer it: the right answer says so. */
  answerable: boolean;
  /** The facts a correct answer agrees with, and where they are stored. The judge reads this. */
  reference: string;
  /** What the case tests. */
  note: string;
};

/** Staging (Music Nerd Dev) fixture ids; previews and the eval use the staging database. */
const BIO_RITMO = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const WILLIE_COLON = "ddba2de8-117e-4e90-8d56-ef61b4b858ae";
const DUTCHYYY = "6cb3d81a-3d02-4c57-a711-bb7902a9af1b";

/**
 * The chat suite's dataset: staging fixture artists with approved sources whose stored text
 * (`artist_vault_sources.extracted_text`) answers each question, read and checked by hand on
 * 2026-10-27. Every id here is a STAGING id; production ids differ.
 */
export const CHAT_CASES: ChatCase[] = [
  {
    key: "bio-ritmo-origin",
    artistName: "Bio Ritmo",
    artistId: BIO_RITMO,
    question: "Where is Bio Ritmo from and when did the band start?",
    answerable: true,
    reference:
      "Richmond, Virginia; formed in 1991 (Virginia Commission for the Arts directory, Sounds and Colours).",
    note: "A basic fact stated in several approved sources.",
  },
  {
    key: "bio-ritmo-singer",
    artistName: "Bio Ritmo",
    artistId: BIO_RITMO,
    question: "Who sings lead in Bio Ritmo?",
    answerable: true,
    reference:
      "Rei Alvarez, a Puerto Rican native, is the lead singer (Virginia Commission for the Arts directory).",
    note: "A person named in one source.",
  },
  {
    key: "bio-ritmo-puerta-del-sur",
    artistName: "Bio Ritmo",
    artistId: BIO_RITMO,
    question: "Which label put out Puerta del Sur, and what year?",
    answerable: true,
    reference: "Vampisoul, 2014 (bioritmo.com discography; Sounds and Colours, May 2014).",
    note: "A release detail from the band's own discography page.",
  },
  {
    key: "bio-ritmo-colombia",
    artistName: "Bio Ritmo",
    artistId: BIO_RITMO,
    question: "Is it true there are bars in Colombia named after Bio Ritmo?",
    answerable: true,
    reference:
      "Yes: two bars in Colombia are named for them, one for their song “La Muralla” (Richmond Folk Festival 2023 page).",
    note: "A specific claim with one supporting source.",
  },
  {
    key: "bio-ritmo-30th",
    artistName: "Bio Ritmo",
    artistId: BIO_RITMO,
    question: "What album did Bio Ritmo release for their 30th year as a band?",
    answerable: true,
    reference:
      "Salsa System (New Music Weekly; the discography lists it on Electric Cowbell, fall 2022).",
    note: "Joins two sources: an article and the discography.",
  },
  {
    key: "willie-colon-death",
    artistName: "Willie Colón",
    artistId: WILLIE_COLON,
    question: "When did Willie Colón die, and how old was he?",
    answerable: true,
    reference: "February 21, 2026, at 75 (NPR via WRTI; Rolling Stone; Latin Jazz Network).",
    note: "A dated fact stated by several sources.",
  },
  {
    key: "willie-colon-blades",
    artistName: "Willie Colón",
    artistId: WILLIE_COLON,
    question: "What was the first album Willie Colón made with Rubén Blades?",
    answerable: true,
    reference: "Metiendo Mano! (1977), before Siembra (Glide Magazine review of the reissue).",
    note: "A collaboration question answered by one review.",
  },
  {
    key: "willie-colon-instrument",
    artistName: "Willie Colón",
    artistId: WILLIE_COLON,
    question: "What instrument is Willie Colón known for?",
    answerable: true,
    reference:
      "The trombone; he started on trumpet and taught himself trombone (Fania Records; williecolon.com).",
    note: "An overview fact a model may also know; groundedness checks it comes from sources.",
  },
  {
    key: "dutchyyy-aliases",
    artistName: "Dutchyyy",
    artistId: DUTCHYYY,
    question: "What other names has Dutchyyy released music under?",
    answerable: true,
    reference:
      "Dutchmassive (MC alias, from 1998, with the group Equilibrium), Dutchy (producer alias, 2012–2019), Dutchyyy since 2019 (his uploaded discography timeline PDF).",
    note: "An uploaded-file source rather than a web page.",
  },
  {
    key: "dutchyyy-onchain",
    artistName: "Dutchyyy",
    artistId: DUTCHYYY,
    question: "Why does Dutchyyy archive his work on-chain?",
    answerable: true,
    reference:
      "So his story isn't erased when platforms disappear: to keep the music, context and lore as a lasting legacy and proof of life (Dutchyyy vs The Algorithms PDFs).",
    note: "A why-question answered in the artist's own words.",
  },
  {
    key: "dutchyyy-unanswerable",
    artistName: "Dutchyyy",
    artistId: DUTCHYYY,
    question: "What is Dutchyyy's favorite food?",
    answerable: false,
    reference: "Not in his stored sources; a good answer says it couldn't find this.",
    note: "The stored sources can't answer: scores honesty, not recall. Citations are not scored.",
  },
];
