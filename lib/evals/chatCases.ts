import type { ChatFact } from "@/lib/evals/scoreFacts";
import {
  BIO_RITMO,
  CELIA_CRUZ,
  DUTCHYYY,
  JORDAN_REIN,
  LATASHA,
  PETE_RANGO,
  SOUND_OF_FRACTURES,
  WILLIE_COLON,
} from "@/lib/evals/evalArtists";

/** What a chat question tests, so a report can show which kinds of question fail. */
export type ChatCaseShape =
  "single-fact" | "list" | "disagreement" | "deep-detail" | "wrong-person" | "not-in-lore" | "why";

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
  /**
   * The facts every correct answer contains, checked by matching (`scoreFacts`), never by the
   * judge. Each is one spelling or a list of acceptable spellings.
   */
  facts?: ChatFact[];
  /** What the question tests. */
  shape?: ChatCaseShape;
  /** The kinds of saved document the question relies on: article, interview, review, profile, pdf, website. */
  kinds?: string[];
  /**
   * Why the judge's scores on this question stay out of the run means (they are still printed).
   * Only for a question with a fact checklist, and only after its answers were read against the
   * documents and found better than the scores.
   */
  judgeAdvisory?: string;
  /** A second question asked with this answer in the conversation, scored as its own row. */
  followUp?: { question: string; reference: string; facts?: ChatFact[] };
};

/**
 * The chat suite's dataset (thirty-three questions over eight artists since 2026-11-15): staging fixture artists with approved sources whose stored text
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
    facts: ["Richmond", "1991"],
    shape: "single-fact",
    kinds: ["article"],
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
    facts: ["Rei Alvarez"],
    shape: "single-fact",
    kinds: ["article"],
    note: "A person named in one source.",
  },
  {
    key: "bio-ritmo-puerta-del-sur",
    artistName: "Bio Ritmo",
    artistId: BIO_RITMO,
    question: "Which label put out Puerta del Sur, and what year?",
    answerable: true,
    reference: "Vampisoul, 2014 (bioritmo.com discography; Sounds and Colours, May 2014).",
    facts: ["Vampisoul", "2014"],
    shape: "single-fact",
    kinds: ["website", "article"],
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
    facts: ["La Muralla", ["two", "2"]],
    shape: "single-fact",
    kinds: ["article"],
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
    facts: ["Salsa System"],
    shape: "single-fact",
    kinds: ["article", "website"],
    note: "Joins two sources: an article and the discography.",
  },
  {
    key: "willie-colon-death",
    artistName: "Willie Colón",
    artistId: WILLIE_COLON,
    question: "When did Willie Colón die, and how old was he?",
    answerable: true,
    reference: "February 21, 2026, at 75 (NPR via WRTI; Rolling Stone; Latin Jazz Network).",
    facts: [["February 21", "21 February", "Feb 21"], "2026", ["75", "seventy-five"]],
    shape: "single-fact",
    kinds: ["article"],
    note: "A dated fact stated by several sources.",
  },
  {
    key: "willie-colon-blades",
    artistName: "Willie Colón",
    artistId: WILLIE_COLON,
    question: "What was the first album Willie Colón made with Rubén Blades?",
    answerable: true,
    reference:
      "Metiendo Mano! (1977): Glide calls it the first collaboration between Colón and Blades, and Fania calls Siembra (1978) their second. Rolling Stone says Colón recorded The Good, The Bad, The Ugly (1975) with Lavoe, Rubén Blades and Yomo Toro, which puts Blades on an earlier Colón album. A good answer gives both accounts and says which source says which; it may lead with Metiendo Mano!. It must not explain the difference with a distinction no document states (guest versus partner, billing, whose album it was). The Cua Cua Ra, Cua Cua / 1975 heading is a song-section date, not independently an album-release date.",
    facts: ["Metiendo Mano", "The Good, the Bad, the Ugly"],
    shape: "disagreement",
    kinds: ["article"],
    note: "Two accounts to attribute, with no distinction the documents do not state (reference v3, 2026-11-15: v2 required calling the question unresolved, which marked down answers that gave both accounts).",
    judgeAdvisory:
      "Read on 2026-11-15: answers that named the album two documents support and attributed both accounts scored 0.35 to 0.45; single trials have ranged from 0.22 to 0.78 on identical runs.",
  },
  {
    key: "willie-colon-instrument",
    artistName: "Willie Colón",
    artistId: WILLIE_COLON,
    question: "What instrument is Willie Colón known for?",
    answerable: true,
    reference:
      "The trombone; he started on trumpet and taught himself trombone (Fania Records; williecolon.com).",
    facts: ["trombone"],
    shape: "single-fact",
    kinds: ["article", "website"],
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
    facts: ["Dutchmassive", "Dutchy", "The Chill Factor"],
    shape: "list",
    kinds: ["pdf"],
    note: "An uploaded-file source rather than a web page (reference v2, 2026-11-06 audit).",
    judgeAdvisory:
      "Read on 2026-11-15: answers listing every alias scored 0.45 to 0.62 (the judge ticks the groups, named as groups, as miscategorised); single trials have ranged from 0.45 to 0.82 on identical runs.",
    // The follow-up only makes sense with the first answer in the conversation.
    followUp: {
      question: "Which of those names is the producer alias?",
      facts: ["Dutchy"],
      reference:
        "Dutchy, the producer alias, used 2012–2019 per the timeline's overview (p.1); Dutchmassive is the MC alias and Dutchyyy the primary alias. Naming Dutchy with that page is complete; the answer need not repeat the whole list, and may re-read the PDF or rely on the earlier answer.",
    },
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
    facts: ["Dutchmassive", "Dutchy", "The Chill Factor", "1998", "2012", "2019", "2001"],
    shape: "list",
    kinds: ["pdf"],
    note: "Multi-part inventory plus overlap from one 13-page PDF: the #1424 acceptance question, pages verified against the original on 2026-11-12.",
  },
  {
    key: "dutchyyy-onchain",
    artistName: "Dutchyyy",
    artistId: DUTCHYYY,
    question: "Why does Dutchyyy archive his work on-chain?",
    answerable: true,
    reference:
      "So his story isn't erased when platforms disappear: to keep the music, context and lore as a lasting legacy and proof of life (Dutchyyy vs The Algorithms PDFs).",
    shape: "why",
    kinds: ["pdf"],
    note: "A why-question answered in the artist's own words.",
  },
  {
    key: "dutchyyy-unanswerable",
    artistName: "Dutchyyy",
    artistId: DUTCHYYY,
    question: "What is Dutchyyy's favorite food?",
    answerable: false,
    reference: "Not in his stored sources; a good answer says it couldn't find this.",
    shape: "not-in-lore",
    note: "The stored sources can't answer: scores honesty, not recall. Citations are not scored.",
  },
  {
    key: "pete-rango-origin",
    artistName: "Pete Rango",
    artistId: PETE_RANGO,
    question: "Where was Pete Rango born, and where did his family move when he was a kid?",
    answerable: true,
    reference:
      "Born in Bogotá, Colombia; his family moved to Fairfax, Virginia when he was 11 (Voyage MIA interview, 2019).",
    facts: ["Bogotá", "Fairfax"],
    shape: "single-fact",
    kinds: ["interview"],
    note: "Two facts from the opening of one interview.",
  },
  {
    key: "pete-rango-tv-placements",
    artistName: "Pete Rango",
    artistId: PETE_RANGO,
    question: "Which TV shows have featured Pete Rango's music?",
    answerable: true,
    reference:
      "His own site lists sync placements on DTF St. Louis (HBO), Rap Sh!t season 2 (HBO Max), Tyler Perry's Sistas (BET), My Celebrity Dream Wedding (VH1) and two episodes of HBO's Insecure (season 1 episode 6, season 3 episode 8). The same list has non-TV placements (NBA Top Shot WNBA, a Represent runway show, DoorDash, Capital One), which a good answer may name as what they are but should not call TV shows.",
    facts: [
      ["DTF St. Louis", "DTF"],
      ["Rap Sh!t", "Rap Shit"],
      "Sistas",
      "My Celebrity Dream Wedding",
      "Insecure",
    ],
    shape: "list",
    kinds: ["website"],
    note: "A full list from the artist's own site, where the list is page furniture rather than prose and mixes TV with other placements.",
  },
  {
    key: "pete-rango-founded",
    artistName: "Pete Rango",
    artistId: PETE_RANGO,
    question: "What has Pete Rango founded or co-founded?",
    answerable: true,
    reference:
      "XUE Records and the non-profit L.I.V. (Life Is Valuable), per the Life Changes Show guest page; his own site adds Dead Set FC, a football-culture documentary collective founded with Kevin Carroll and Roderick Deerr.",
    facts: ["XUE", ["Life Is Valuable", "L.I.V", "LIV"], ["Dead Set FC", "Dead Set"]],
    shape: "list",
    kinds: ["article", "website"],
    note: "Items spread over two documents; Dead Set FC is stated once, in a project card.",
  },
  {
    key: "pete-rango-insecure-song",
    artistName: "Pete Rango",
    artistId: PETE_RANGO,
    question: "Which Pete Rango song landed on HBO's Insecure, and who is the artist on it?",
    answerable: true,
    reference: "“Vi$ions”, a song he made with Cherele (Voyage MIA interview).",
    facts: [["Vi$ions", "Visions"], "Cherele"],
    shape: "deep-detail",
    kinds: ["interview"],
    note: "One sentence in the middle of a long first-person paragraph.",
  },
  {
    key: "pete-rango-vcu-graduation",
    artistName: "Pete Rango",
    artistId: PETE_RANGO,
    question: "What year did Pete Rango graduate from VCU?",
    answerable: false,
    reference:
      "Not stated. The Voyage MIA interview says he went to college in 2008 and left for Florida shortly after his first semester at VCU; no saved document says he graduated or when. A good answer says the sources do not give a graduation year and does not work one out (for example 2012).",
    shape: "not-in-lore",
    kinds: ["interview"],
    note: "The documents invite an inference (started 2008) they do not support.",
  },
  {
    key: "latasha-roots",
    artistName: "LATASHÁ",
    artistId: LATASHA,
    question: "Where did LATASHÁ grow up, and what is her family's cultural background?",
    answerable: true,
    reference:
      "Brooklyn (Flatbush). Her mother is Puerto Rican and Haitian and her father is Jamaican and Panamanian. Two saved documents are about a different person, Latasha Harlins of Los Angeles (killed in 1991); nothing from them belongs in the answer.",
    facts: [["Flatbush", "Brooklyn"], "Puerto Rican", "Haitian", "Jamaican", "Panamanian"],
    shape: "wrong-person",
    kinds: ["article"],
    note: "The artist's saved documents include two about a namesake; a careless answer blends the biographies.",
  },
  {
    key: "latasha-opened-for",
    artistName: "LATASHÁ",
    artistId: LATASHA,
    question: "Which well-known artists has LATASHÁ opened for?",
    answerable: true,
    reference: "Kanye West, Q-Tip, Big Sean, Princess Nokia and Ghostface Killah.",
    facts: [
      "Princess Nokia",
      ["Ghostface Killah", "Ghostface"],
      ["Kanye West", "Kanye"],
      ["Q-Tip", "QTip"],
      "Big Sean",
    ],
    shape: "list",
    kinds: ["article"],
    note: "Names spread over several articles; Ghostface Killah appears in one only.",
  },
  {
    key: "latasha-nft-sales-2021",
    artistName: "LATASHÁ",
    artistId: LATASHA,
    question: "How much did LATASHÁ make from NFT sales in 2021?",
    answerable: true,
    reference: "More than $100,000 (Decential Media, August 2024).",
    facts: [["100,000", "100000", "100k", "100 thousand"]],
    shape: "deep-detail",
    kinds: ["article"],
    note: "A figure in the second half of a long article.",
  },
  {
    key: "latasha-who-i-am-netflix",
    artistName: "LATASHÁ",
    artistId: LATASHA,
    question: "Which Netflix series used LATASHÁ's song “WHO I AM”?",
    answerable: true,
    reference: "Self Made.",
    facts: ["Self Made"],
    shape: "single-fact",
    kinds: ["article"],
    note: "Named in two articles.",
  },
  {
    key: "celia-cruz-album-count",
    artistName: "Celia Cruz",
    artistId: CELIA_CRUZ,
    question: "How many albums did Celia Cruz make?",
    answerable: true,
    reference:
      "The saved documents disagree: her official site says over 50 albums, Wikipedia counts 37 studio albums (plus live albums and collaborations), and the Celia Cruz Foundation biography says more than 70. A good answer gives each figure with its source and does not present one as settled; it may note that the 37 counts studio albums only.",
    facts: [
      ["50", "fifty"],
      ["37", "thirty-seven"],
      ["70", "seventy"],
    ],
    shape: "disagreement",
    kinds: ["website", "profile", "article"],
    note: "Three documents, three counts.",
  },
  {
    key: "celia-cruz-honorary-doctorates",
    artistName: "Celia Cruz",
    artistId: CELIA_CRUZ,
    question: "Which universities gave Celia Cruz honorary doctorates?",
    answerable: true,
    reference: "Yale University, Florida International University and the University of Miami.",
    facts: ["Yale", ["Florida International University", "FIU"], "University of Miami"],
    shape: "list",
    kinds: ["profile", "article"],
    note: "Stated in two long documents, far from their openings.",
  },
  {
    key: "celia-cruz-last-show",
    artistName: "Celia Cruz",
    artistId: CELIA_CRUZ,
    question: "Where was Celia Cruz's last official show?",
    answerable: true,
    reference:
      "At the Hipódromo de las Américas in Mexico City, on 27 November 2002. Her 2003 appearances (the Grammys, a televised tribute, a gala) were not official shows.",
    facts: ["Hipódromo de las Américas", "Mexico City"],
    shape: "deep-detail",
    kinds: ["profile"],
    note: "In the fifth of nine passages of a 50,000-character document.",
  },
  {
    key: "jordan-rein-earlier-bands",
    artistName: "Jordan Rein",
    artistId: JORDAN_REIN,
    question: "Which bands was Jordan Rein in before REIN?",
    answerable: true,
    reference:
      "Yesterday and Tomorrow (his first band, at 16), Five Second Rule, which grew out of it, and Hollywood Cemetery (RVA Mag interview).",
    facts: ["Yesterday and Tomorrow", "Five Second Rule", "Hollywood Cemetery"],
    shape: "list",
    kinds: ["interview"],
    note: "Three names in one dense paragraph.",
  },
  {
    key: "jordan-rein-flying-lawnmower",
    artistName: "Jordan Rein",
    artistId: JORDAN_REIN,
    question:
      "How old was Jordan Rein when he started building his flying lawnmower, and where did the kit come from?",
    answerable: true,
    reference: "He says he was 21, and the kit he ordered came from Germany (podcast transcript).",
    facts: [
      ["21", "twenty-one"],
      ["Germany", "German"],
    ],
    shape: "deep-detail",
    kinds: ["transcript"],
    note: "About 40 minutes into an automatic speech transcript saved twice, with words run together.",
  },
  {
    key: "jordan-rein-partscaster-pickups",
    artistName: "Jordan Rein",
    artistId: JORDAN_REIN,
    question: "What pickups are in Jordan Rein's Partscaster?",
    answerable: false,
    reference:
      "Not stated. The saved documents say he built the Partscaster and plays it at nearly every show; none lists its pickups or parts. A good answer says so and names no pickup brand or model.",
    shape: "not-in-lore",
    kinds: ["interview"],
    note: "The documents mention the guitar, which invites a guess at typical parts.",
  },
  {
    key: "sound-of-fractures-mother",
    artistName: "Sound of Fractures",
    artistId: SOUND_OF_FRACTURES,
    question: "What did Sound of Fractures' mother do in the music industry?",
    answerable: true,
    reference:
      "She was Head of International at Island Records before leaving to raise him (Decential Media).",
    facts: [["Island Records", "Island"]],
    shape: "single-fact",
    kinds: ["article"],
    note: "An artist with a single saved article, cut off at 5,000 characters.",
  },
  {
    key: "willie-colon-last-fight-year",
    artistName: "Willie Colón",
    artistId: WILLIE_COLON,
    question: "What year did Willie Colón's film The Last Fight come out?",
    answerable: true,
    reference:
      "The saved documents disagree: the Fania liner notes date The Last Fight to 1982 and the LA Phil biography to 1983. A good answer gives both years with their sources.",
    facts: ["1982", "1983"],
    shape: "disagreement",
    kinds: ["article"],
    note: "A one-year conflict between two documents.",
  },
  {
    key: "willie-colon-celia-cruz-albums",
    artistName: "Willie Colón",
    artistId: WILLIE_COLON,
    question: "Which albums did Willie Colón make with Celia Cruz?",
    answerable: true,
    reference:
      "Only They Could Have Made This Album (1977), Celia & Willie (1981) and The Winners, which the Fania liner notes call their last pairing.",
    facts: [
      "Only They Could Have Made This Album",
      "The Winners",
      ["Celia & Willie", "Celia and Willie", "Celia y Willie"],
    ],
    shape: "list",
    kinds: ["article"],
    note: "Spread over three documents; Celia & Willie appears once, in a headline listing.",
  },
  {
    key: "willie-colon-toma-mis-manos",
    artistName: "Willie Colón",
    artistId: WILLIE_COLON,
    question: "What inspired Willie Colón's song “Toma Mis Manos”?",
    answerable: true,
    reference:
      "The unexpected death of his only sibling, his sister Cindy, who had sung backing vocals on some of his sessions (Fania liner notes).",
    facts: ["Cindy", ["sister", "sibling"]],
    shape: "deep-detail",
    kinds: ["article"],
    note: "In the last passage of a 20,000-character document.",
  },
  {
    key: "bio-ritmo-major-label",
    artistName: "Bio Ritmo",
    artistId: BIO_RITMO,
    question: "Did Bio Ritmo ever sign with a major label, and how big was the advance?",
    answerable: true,
    reference:
      "Yes: around 1997 they signed to Triloka, a subsidiary of Mercury Records, for an advance reported at about $50,000 (Richmond Magazine profile).",
    facts: ["Triloka", "Mercury", ["50,000", "50000", "50k"]],
    shape: "deep-detail",
    kinds: ["article"],
    note: "In the fourth of six passages of a 32,000-character profile.",
  },
  {
    key: "bio-ritmo-salsa-system-year",
    artistName: "Bio Ritmo",
    artistId: BIO_RITMO,
    question: "What year did Bio Ritmo's Salsa System first come out?",
    answerable: true,
    reference:
      "The saved documents disagree: the Richmond Magazine timeline says 2005, while New Music Weekly, the band's discography page and Sounds and Colours say 2006. A good answer gives both and may say most sources give 2006. The 2022 vinyl for the band's 30th year is a reissue, not the first release.",
    facts: ["2005", "2006"],
    shape: "disagreement",
    kinds: ["article", "website"],
    note: "One document against three, with a later reissue as a trap.",
  },
];
