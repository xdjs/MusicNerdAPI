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
  /** Times the question is asked per run, for a behaviour that varies between runs; default 1. */
  trials?: number;
};

/** Staging (Music Nerd Dev) fixture ids; previews and the eval use the staging database. */
const BIO_RITMO = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const WILLIE_COLON = "ddba2de8-117e-4e90-8d56-ef61b4b858ae";
const DUTCHYYY = "6cb3d81a-3d02-4c57-a711-bb7902a9af1b";

/**
 * The chat suite's dataset: staging fixture artists with approved sources whose stored text
 * (`artist_vault_sources.extracted_text`) or uploaded PDFs answer each question, read and checked
 * by hand on 2026-10-27, with reference corrections from the 2026-11-06 retained-evidence audit
 * and the 2026-11-12 acceptance question. Every id here is a STAGING id; production ids differ.
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
    reference:
      "The first album remains unresolved from the conflicting saved accounts. Glide calls Metiendo Mano! (1977) the first collaboration. Rolling Stone says Colón recorded The Good, The Bad, The Ugly with Lavoe, Rubén Blades and Yomo Toro. Attribute both accounts, including uncertainty in the opening; do not invent full-versus-partial collaboration, billing or participant distinctions. The Cua Cua Ra, Cua Cua / 1975 heading is a song-section date, not independently an album-release date.",
    note: "Competing saved accounts: assesses useful coverage and supported distinctions, not recall of one review's answer (reference v2, 2026-11-06 audit).",
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
      "Source-supported other names include Dutchmassive, Dutchy and The Chill Factor: the PDF explicitly identifies the latter as a credited alias in its 2001 We're Here Now entry (p.2), full use span unknown. Role or current-name context is optional: Dutchmassive is the MC alias, Dutchy the producer alias, Dutchyyy the primary alias. Equilibrium and Walkmen are groups; The Hobbyshop Hero is a parenthetical credit, not a required established alias on this evidence. If dates are given, preserve the PDF's roles: Dutchmassive 1998–present, Dutchy 2012–2019, Dutchyyy 2019–present as primary alias, not first-ever use. Dated examples or credits alone do not establish complete use/overlap bounds. Accept additional names only when supported by read evidence. Dates and extra context are not required when the question only asks for names.",
    note: "An uploaded-file source rather than a web page (reference v2, 2026-11-06 audit).",
  },
  {
    key: "dutchyyy-alias-years",
    artistName: "Dutchyyy",
    artistId: DUTCHYYY,
    question:
      "Which years did Dutchyyy use each artist alias, and which were used at the same time?",
    answerable: true,
    reference:
      "From the uploaded discography timeline PDF (13 pages). Page 1 lists Dutchmassive 1998–present (MC/rapper alias), Dutchy 2012–2019 (producer alias) and Dutchyyy 2019–present (primary alias). The Chill Factor is a one-off alias documented in 2001 on We're Here Now (p.2). Used at the same time: Dutchmassive ran alongside Dutchy, with both names on one release, for example Blue Screen of Deaf (2012, p.7) and the 2013 Astral Basement compilation (p.8); Dutchmassive and Dutchyyy are both credited on The Reluctant Clap (2023, p.11); Dutchy and Dutchyyy overlap only around the 2018–2019 transition (RawSauce Remix, p.10). A documented year is not proof of a start, end or continuous use; the timeline calls itself incomplete, and Dutchyyy also appears as a 2007 production credit (p.5). Equilibrium and Walkmen are groups, not solo aliases; The Hobbyshop Hero is a parenthetical credit (p.4). An answer that gives the three overview aliases with years and at least one same-release overlap, cites the PDF with page numbers and states the timeline's own uncertainty is complete; omitting The Chill Factor is the main completeness gap.",
    note: "Multi-part inventory plus overlap from one 13-page PDF: the #1424 acceptance question, pages verified against the original on 2026-11-12.",
    // The Chill Factor credit on page 2 appears in about half of runs; three trials make the
    // score a rate instead of a coin flip.
    trials: 3,
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
