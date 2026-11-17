import type { UnitSourceKind } from "@/lib/units/types";

/** One unit that states a fact: a source and the page (or chunk) locator within it. Source ids are UUIDs, not secrets. */
export type ExpectedUnit = { sourceKind: UnitSourceKind; sourceId: string; locator: string };

/** One fact a good search surfaces: found when ANY of its units is among the hits. */
export type RetrievalFact = { fact: string; anyOf: ExpectedUnit[] };

/**
 * The retrieval suite's labels, by case key (a follow-up is `<key>/follow-up`).
 *
 * Labels were located on 2026-11-14 by keyword from the audited reference answers in
 * `chatCases.ts`, independently of the ranking under test, and confirmed by the controller under
 * the owner's delegation. A fact is found if any one of its units is retrieved. Fact names are
 * short labels written by us, never document text. The unanswerable case has no facts.
 */
export const RETRIEVAL_LABELS: Record<string, RetrievalFact[]> = {
  "bio-ritmo-30th": [
    {
      fact: "Salsa System for the 30th year",
      anyOf: [
        { sourceKind: "vault", sourceId: "47bc5003-0802-4d18-933a-7a1fc04cf077", locator: "¶1" },
        { sourceKind: "vault", sourceId: "635a4493-d845-43da-bfdf-b30bf7af1298", locator: "¶1" },
        { sourceKind: "social", sourceId: "40ea632d-85c2-48f1-a697-1692182d69a9", locator: "¶1" },
        { sourceKind: "social", sourceId: "fc78ca1a-0de6-4847-bfce-1fcc462af5ff", locator: "¶1" },
      ],
    },
  ],
  "bio-ritmo-colombia": [
    {
      fact: "bars in Colombia named for them",
      anyOf: [
        { sourceKind: "vault", sourceId: "635a4493-d845-43da-bfdf-b30bf7af1298", locator: "¶1" },
        { sourceKind: "vault", sourceId: "8c16811b-a6fb-484f-be99-70d56880dfc3", locator: "¶1" },
        { sourceKind: "vault", sourceId: "f6392f7a-52f9-44a6-a270-fda932df6405", locator: "¶1" },
      ],
    },
  ],
  "bio-ritmo-origin": [
    {
      fact: "Richmond, formed 1991",
      anyOf: [
        { sourceKind: "vault", sourceId: "2474ea20-a506-4808-b809-2d4aba9c5955", locator: "¶1" },
        { sourceKind: "vault", sourceId: "39365fec-79c8-4522-8b86-9c1e7a8860ea", locator: "¶1" },
        { sourceKind: "vault", sourceId: "635a4493-d845-43da-bfdf-b30bf7af1298", locator: "¶1" },
        { sourceKind: "vault", sourceId: "635a4493-d845-43da-bfdf-b30bf7af1298", locator: "¶75" },
        { sourceKind: "vault", sourceId: "8c16811b-a6fb-484f-be99-70d56880dfc3", locator: "¶1" },
        { sourceKind: "vault", sourceId: "ced344df-8589-469b-9988-aa5dda7949ed", locator: "¶1" },
        { sourceKind: "vault", sourceId: "f6392f7a-52f9-44a6-a270-fda932df6405", locator: "¶1" },
      ],
    },
  ],
  "bio-ritmo-puerta-del-sur": [
    {
      fact: "Vampisoul, 2014",
      anyOf: [
        { sourceKind: "vault", sourceId: "0f469ab6-2ef2-435e-b562-4f4a399ca5c5", locator: "¶1" },
        { sourceKind: "vault", sourceId: "f6392f7a-52f9-44a6-a270-fda932df6405", locator: "¶1" },
      ],
    },
  ],
  "bio-ritmo-singer": [
    {
      fact: "Rei Alvarez sings lead",
      anyOf: [
        { sourceKind: "vault", sourceId: "1e53c007-1fb3-449e-9ed3-8ea83122a665", locator: "¶1" },
        { sourceKind: "vault", sourceId: "2474ea20-a506-4808-b809-2d4aba9c5955", locator: "¶1" },
        { sourceKind: "vault", sourceId: "2da0a160-e3d1-488d-9472-e690d018f623", locator: "¶1" },
        { sourceKind: "vault", sourceId: "39365fec-79c8-4522-8b86-9c1e7a8860ea", locator: "¶1" },
        { sourceKind: "vault", sourceId: "4250580c-6068-4ee0-af2c-42e317fbcab4", locator: "¶1" },
        { sourceKind: "vault", sourceId: "47bc5003-0802-4d18-933a-7a1fc04cf077", locator: "¶1" },
        { sourceKind: "vault", sourceId: "635a4493-d845-43da-bfdf-b30bf7af1298", locator: "¶1" },
        { sourceKind: "vault", sourceId: "635a4493-d845-43da-bfdf-b30bf7af1298", locator: "¶75" },
        { sourceKind: "vault", sourceId: "8c16811b-a6fb-484f-be99-70d56880dfc3", locator: "¶1" },
        { sourceKind: "vault", sourceId: "ced344df-8589-469b-9988-aa5dda7949ed", locator: "¶1" },
        { sourceKind: "vault", sourceId: "f6392f7a-52f9-44a6-a270-fda932df6405", locator: "¶1" },
        { sourceKind: "social", sourceId: "296a0fa2-95e6-4d54-9197-cae61b5b8d50", locator: "¶1" },
        { sourceKind: "social", sourceId: "72a71031-f9ed-41ba-ab32-4e965c876e6a", locator: "¶1" },
        { sourceKind: "social", sourceId: "b0f720f9-4592-4275-bc03-7503c766b36e", locator: "¶1" },
        { sourceKind: "social", sourceId: "c9004460-fd6c-4c2e-97ca-d455bf239e54", locator: "¶1" },
      ],
    },
  ],
  "dutchyyy-aliases": [
    {
      fact: "The Chill Factor (2001)",
      anyOf: [
        { sourceKind: "vault", sourceId: "84b02b2a-a406-4ca0-9adf-757a5f494d02", locator: "p.2" },
        { sourceKind: "vault", sourceId: "84b02b2a-a406-4ca0-9adf-757a5f494d02", locator: "p.3" },
      ],
    },
    {
      fact: "the names Dutchmassive and Dutchy",
      anyOf: [
        { sourceKind: "vault", sourceId: "2c623f78-412c-48f1-8a9b-2a3890e11e4d", locator: "p.4" },
        { sourceKind: "vault", sourceId: "2c623f78-412c-48f1-8a9b-2a3890e11e4d", locator: "p.5" },
        { sourceKind: "vault", sourceId: "84b02b2a-a406-4ca0-9adf-757a5f494d02", locator: "p.1" },
        { sourceKind: "vault", sourceId: "84b02b2a-a406-4ca0-9adf-757a5f494d02", locator: "p.6" },
        { sourceKind: "vault", sourceId: "84b02b2a-a406-4ca0-9adf-757a5f494d02", locator: "p.7" },
        { sourceKind: "vault", sourceId: "84b02b2a-a406-4ca0-9adf-757a5f494d02", locator: "p.8" },
        { sourceKind: "vault", sourceId: "84b02b2a-a406-4ca0-9adf-757a5f494d02", locator: "p.9" },
        { sourceKind: "vault", sourceId: "84b02b2a-a406-4ca0-9adf-757a5f494d02", locator: "p.10" },
        { sourceKind: "vault", sourceId: "9c4911b5-090f-443b-93f7-a4f4e861909e", locator: "p.13" },
        { sourceKind: "vault", sourceId: "9c4911b5-090f-443b-93f7-a4f4e861909e", locator: "p.27" },
        { sourceKind: "social", sourceId: "4eb888aa-180b-4c65-80ea-40e27e298bd6", locator: "¶1" },
        { sourceKind: "social", sourceId: "50e5aab8-a600-4aee-bbff-ce44d07aab9a", locator: "¶1" },
        { sourceKind: "social", sourceId: "98c836bf-b055-4180-abc8-239a02daa088", locator: "¶1" },
        { sourceKind: "social", sourceId: "ef824147-1e0c-4e28-a782-b1f4025bad5e", locator: "¶1" },
        { sourceKind: "evidence", sourceId: "082ecd33-88d0-46ff-b475-656548c0a435", locator: "¶1" },
      ],
    },
  ],
  "dutchyyy-aliases/follow-up": [
    {
      fact: "which name is the producer alias",
      anyOf: [
        { sourceKind: "vault", sourceId: "2c623f78-412c-48f1-8a9b-2a3890e11e4d", locator: "p.5" },
        { sourceKind: "vault", sourceId: "84b02b2a-a406-4ca0-9adf-757a5f494d02", locator: "p.1" },
        { sourceKind: "vault", sourceId: "84b02b2a-a406-4ca0-9adf-757a5f494d02", locator: "p.6" },
        { sourceKind: "vault", sourceId: "84b02b2a-a406-4ca0-9adf-757a5f494d02", locator: "p.7" },
        { sourceKind: "vault", sourceId: "9c4911b5-090f-443b-93f7-a4f4e861909e", locator: "p.27" },
      ],
    },
  ],
  "dutchyyy-alias-years": [
    {
      fact: "same-time example (2012)",
      anyOf: [
        { sourceKind: "vault", sourceId: "2c623f78-412c-48f1-8a9b-2a3890e11e4d", locator: "p.5" },
        { sourceKind: "vault", sourceId: "84b02b2a-a406-4ca0-9adf-757a5f494d02", locator: "p.7" },
        { sourceKind: "vault", sourceId: "9c4911b5-090f-443b-93f7-a4f4e861909e", locator: "p.13" },
        { sourceKind: "vault", sourceId: "9c4911b5-090f-443b-93f7-a4f4e861909e", locator: "p.39" },
      ],
    },
    {
      fact: "The Chill Factor (2001)",
      anyOf: [
        { sourceKind: "vault", sourceId: "84b02b2a-a406-4ca0-9adf-757a5f494d02", locator: "p.2" },
        { sourceKind: "vault", sourceId: "84b02b2a-a406-4ca0-9adf-757a5f494d02", locator: "p.3" },
      ],
    },
    {
      fact: "the years overview",
      anyOf: [
        { sourceKind: "vault", sourceId: "2c623f78-412c-48f1-8a9b-2a3890e11e4d", locator: "p.5" },
        { sourceKind: "vault", sourceId: "84b02b2a-a406-4ca0-9adf-757a5f494d02", locator: "p.1" },
        { sourceKind: "vault", sourceId: "84b02b2a-a406-4ca0-9adf-757a5f494d02", locator: "p.2" },
        { sourceKind: "vault", sourceId: "84b02b2a-a406-4ca0-9adf-757a5f494d02", locator: "p.7" },
        { sourceKind: "vault", sourceId: "84b02b2a-a406-4ca0-9adf-757a5f494d02", locator: "p.11" },
      ],
    },
  ],
  "dutchyyy-onchain": [
    {
      fact: "why he archives on-chain",
      anyOf: [
        { sourceKind: "vault", sourceId: "2c623f78-412c-48f1-8a9b-2a3890e11e4d", locator: "p.1" },
        { sourceKind: "vault", sourceId: "2c623f78-412c-48f1-8a9b-2a3890e11e4d", locator: "p.8" },
        { sourceKind: "vault", sourceId: "2c623f78-412c-48f1-8a9b-2a3890e11e4d", locator: "p.10" },
        { sourceKind: "vault", sourceId: "9c4911b5-090f-443b-93f7-a4f4e861909e", locator: "p.1" },
        { sourceKind: "vault", sourceId: "9c4911b5-090f-443b-93f7-a4f4e861909e", locator: "p.29" },
        { sourceKind: "vault", sourceId: "9c4911b5-090f-443b-93f7-a4f4e861909e", locator: "p.30" },
      ],
    },
  ],
  "willie-colon-blades": [
    {
      fact: "Glide account: Metiendo Mano! (1977)",
      anyOf: [
        { sourceKind: "vault", sourceId: "1af89ead-b3f2-461b-9479-fd32a3014c64", locator: "¶1" },
      ],
    },
    {
      fact: "Rolling Stone/Fania account: The Good, The Bad, The Ugly",
      anyOf: [
        { sourceKind: "vault", sourceId: "1f85560d-934f-4852-82f6-8e0373241602", locator: "¶21" },
        { sourceKind: "vault", sourceId: "f16e7797-0086-4a0b-a9d2-f76fe323d3f4", locator: "¶1" },
      ],
    },
  ],
  "willie-colon-death": [
    {
      fact: "died February 21, 2026, aged 75",
      anyOf: [
        { sourceKind: "vault", sourceId: "0430ffae-9e50-4f3d-82e3-4260b4627f48", locator: "¶1" },
        { sourceKind: "vault", sourceId: "e77db64c-cbd4-43be-a368-29d288688c1d", locator: "¶1" },
        { sourceKind: "vault", sourceId: "f16e7797-0086-4a0b-a9d2-f76fe323d3f4", locator: "¶1" },
      ],
    },
  ],
  "willie-colon-instrument": [
    {
      fact: "trombone; started on trumpet",
      anyOf: [
        { sourceKind: "vault", sourceId: "0430ffae-9e50-4f3d-82e3-4260b4627f48", locator: "¶1" },
        { sourceKind: "vault", sourceId: "0a56a8b7-20b3-4bfa-8443-c6c0f95d8973", locator: "¶1" },
        { sourceKind: "vault", sourceId: "1f85560d-934f-4852-82f6-8e0373241602", locator: "¶1" },
        { sourceKind: "vault", sourceId: "1f85560d-934f-4852-82f6-8e0373241602", locator: "¶21" },
        { sourceKind: "vault", sourceId: "1f85560d-934f-4852-82f6-8e0373241602", locator: "¶23" },
        { sourceKind: "vault", sourceId: "6733c03e-db3b-458b-82d0-78a9777fb021", locator: "¶1" },
        { sourceKind: "vault", sourceId: "6733c03e-db3b-458b-82d0-78a9777fb021", locator: "¶28" },
        { sourceKind: "vault", sourceId: "6733c03e-db3b-458b-82d0-78a9777fb021", locator: "¶101" },
        { sourceKind: "vault", sourceId: "c9ba1e8b-331b-44a9-888b-b06e0214eb79", locator: "¶1" },
        { sourceKind: "vault", sourceId: "e77db64c-cbd4-43be-a368-29d288688c1d", locator: "¶1" },
      ],
    },
  ],
  "dutchyyy-unanswerable": [],
  // Added 2026-11-15 for the questions written that day: located by keyword over the staging
  // index (every unit whose text holds the fact), independently of the ranking under test.
  "bio-ritmo-major-label": [
    {
      fact: "Triloka, a Mercury subsidiary",
      anyOf: [
        { sourceKind: "vault", sourceId: "635a4493-d845-43da-bfdf-b30bf7af1298", locator: "¶114" },
        { sourceKind: "vault", sourceId: "a01d5e06-36b5-4b1f-9f17-2a68d5687ed9", locator: "¶1" },
        { sourceKind: "vault", sourceId: "ea02ebcd-4112-4aad-b7cc-07041fe23149", locator: "¶1" },
      ],
    },
    {
      fact: "$50,000 advance",
      anyOf: [
        { sourceKind: "vault", sourceId: "635a4493-d845-43da-bfdf-b30bf7af1298", locator: "¶114" },
      ],
    },
  ],
  "bio-ritmo-salsa-system-year": [
    {
      fact: "2005 (Richmond Magazine timeline)",
      anyOf: [
        { sourceKind: "vault", sourceId: "635a4493-d845-43da-bfdf-b30bf7af1298", locator: "¶1" },
      ],
    },
    {
      fact: "2006 (other documents)",
      anyOf: [
        { sourceKind: "social", sourceId: "f08c1e1f-17d8-4843-b960-eff280bbb761", locator: "¶1" },
        { sourceKind: "vault", sourceId: "0f469ab6-2ef2-435e-b562-4f4a399ca5c5", locator: "¶1" },
        { sourceKind: "vault", sourceId: "47bc5003-0802-4d18-933a-7a1fc04cf077", locator: "¶1" },
        { sourceKind: "vault", sourceId: "635a4493-d845-43da-bfdf-b30bf7af1298", locator: "¶1" },
        { sourceKind: "vault", sourceId: "ea02ebcd-4112-4aad-b7cc-07041fe23149", locator: "¶1" },
        { sourceKind: "vault", sourceId: "f6392f7a-52f9-44a6-a270-fda932df6405", locator: "¶1" },
      ],
    },
  ],
  "celia-cruz-album-count": [
    {
      fact: "over 50 albums (official site)",
      anyOf: [
        { sourceKind: "vault", sourceId: "25d7ffd8-50f2-4fdb-9c4d-5411dce1f6fc", locator: "¶1" },
      ],
    },
    {
      fact: "37 studio albums (Wikipedia)",
      anyOf: [
        { sourceKind: "vault", sourceId: "088a17e8-263f-45e3-81f1-a85909a104b4", locator: "¶102" },
      ],
    },
    {
      fact: "more than 70 albums (Foundation)",
      anyOf: [
        { sourceKind: "vault", sourceId: "ccb569ba-f1de-4a6e-adb0-6437b7bb6f8c", locator: "¶1" },
      ],
    },
  ],
  "celia-cruz-honorary-doctorates": [
    {
      fact: "Yale",
      anyOf: [
        { sourceKind: "vault", sourceId: "ccb569ba-f1de-4a6e-adb0-6437b7bb6f8c", locator: "¶1" },
        { sourceKind: "vault", sourceId: "ccb569ba-f1de-4a6e-adb0-6437b7bb6f8c", locator: "¶46" },
      ],
    },
    {
      fact: "Florida International University",
      anyOf: [
        { sourceKind: "vault", sourceId: "ccb569ba-f1de-4a6e-adb0-6437b7bb6f8c", locator: "¶1" },
        { sourceKind: "vault", sourceId: "ccb569ba-f1de-4a6e-adb0-6437b7bb6f8c", locator: "¶46" },
      ],
    },
    {
      fact: "University of Miami",
      anyOf: [
        { sourceKind: "vault", sourceId: "ccb569ba-f1de-4a6e-adb0-6437b7bb6f8c", locator: "¶1" },
        { sourceKind: "vault", sourceId: "ccb569ba-f1de-4a6e-adb0-6437b7bb6f8c", locator: "¶46" },
      ],
    },
  ],
  "celia-cruz-last-show": [
    {
      fact: "Hipódromo de las Américas, Mexico City",
      anyOf: [
        { sourceKind: "vault", sourceId: "088a17e8-263f-45e3-81f1-a85909a104b4", locator: "¶146" },
      ],
    },
  ],
  "jordan-rein-earlier-bands": [
    {
      fact: "Yesterday and Tomorrow",
      anyOf: [
        { sourceKind: "vault", sourceId: "11ea4b9f-050f-4f9f-b06f-3eeff615a78d", locator: "¶104" },
        { sourceKind: "vault", sourceId: "2e90688e-b2fc-4a3f-8eb6-68492605bff2", locator: "¶1" },
        { sourceKind: "vault", sourceId: "d5b90fd9-e1dc-4b01-87a7-6a0206284b5e", locator: "¶241" },
      ],
    },
    {
      fact: "Five Second Rule",
      anyOf: [
        { sourceKind: "vault", sourceId: "2e90688e-b2fc-4a3f-8eb6-68492605bff2", locator: "¶1" },
      ],
    },
    {
      fact: "Hollywood Cemetery",
      anyOf: [
        { sourceKind: "vault", sourceId: "2e90688e-b2fc-4a3f-8eb6-68492605bff2", locator: "¶1" },
      ],
    },
  ],
  "jordan-rein-flying-lawnmower": [
    {
      fact: "21 years old, kit from Germany",
      anyOf: [
        { sourceKind: "vault", sourceId: "11ea4b9f-050f-4f9f-b06f-3eeff615a78d", locator: "¶302" },
        { sourceKind: "vault", sourceId: "d5b90fd9-e1dc-4b01-87a7-6a0206284b5e", locator: "¶1043" },
      ],
    },
  ],
  "jordan-rein-partscaster-pickups": [],
  "latasha-nft-sales-2021": [
    {
      fact: "more than $100,000 in 2021",
      anyOf: [
        { sourceKind: "vault", sourceId: "badd6785-9f92-4f1e-8a9b-8cb6df86dc4e", locator: "¶34" },
      ],
    },
  ],
  "latasha-opened-for": [
    {
      fact: "Princess Nokia",
      anyOf: [
        { sourceKind: "vault", sourceId: "797d7395-fd22-437b-ac9f-64cee8993373", locator: "¶1" },
        { sourceKind: "vault", sourceId: "969b1f7b-5498-42d6-8b5f-f4b70facba0a", locator: "¶1" },
        { sourceKind: "vault", sourceId: "f0be2975-67cf-4959-aced-69aecf15e3d9", locator: "¶30" },
      ],
    },
    {
      fact: "Ghostface Killah",
      anyOf: [
        { sourceKind: "vault", sourceId: "969b1f7b-5498-42d6-8b5f-f4b70facba0a", locator: "¶1" },
      ],
    },
    {
      fact: "Kanye West",
      anyOf: [
        { sourceKind: "vault", sourceId: "1aefd131-b83e-48e4-8c91-39a38d0f3502", locator: "¶1" },
        { sourceKind: "vault", sourceId: "969b1f7b-5498-42d6-8b5f-f4b70facba0a", locator: "¶1" },
        { sourceKind: "vault", sourceId: "badd6785-9f92-4f1e-8a9b-8cb6df86dc4e", locator: "¶1" },
        { sourceKind: "vault", sourceId: "badd6785-9f92-4f1e-8a9b-8cb6df86dc4e", locator: "¶34" },
      ],
    },
    {
      fact: "Q-Tip",
      anyOf: [
        { sourceKind: "vault", sourceId: "1aefd131-b83e-48e4-8c91-39a38d0f3502", locator: "¶1" },
        { sourceKind: "vault", sourceId: "969b1f7b-5498-42d6-8b5f-f4b70facba0a", locator: "¶1" },
        { sourceKind: "vault", sourceId: "badd6785-9f92-4f1e-8a9b-8cb6df86dc4e", locator: "¶1" },
        { sourceKind: "vault", sourceId: "f0be2975-67cf-4959-aced-69aecf15e3d9", locator: "¶30" },
      ],
    },
    {
      fact: "Big Sean",
      anyOf: [
        { sourceKind: "vault", sourceId: "1aefd131-b83e-48e4-8c91-39a38d0f3502", locator: "¶1" },
        { sourceKind: "vault", sourceId: "797d7395-fd22-437b-ac9f-64cee8993373", locator: "¶1" },
        { sourceKind: "vault", sourceId: "969b1f7b-5498-42d6-8b5f-f4b70facba0a", locator: "¶1" },
        { sourceKind: "vault", sourceId: "badd6785-9f92-4f1e-8a9b-8cb6df86dc4e", locator: "¶1" },
        { sourceKind: "vault", sourceId: "f0be2975-67cf-4959-aced-69aecf15e3d9", locator: "¶30" },
      ],
    },
  ],
  "latasha-roots": [
    {
      fact: "Flatbush, Brooklyn",
      anyOf: [
        { sourceKind: "vault", sourceId: "59bb0406-1128-42e7-9e5f-982e8d2cbf97", locator: "¶1" },
        { sourceKind: "vault", sourceId: "797d7395-fd22-437b-ac9f-64cee8993373", locator: "¶1" },
      ],
    },
    {
      fact: "Puerto Rican and Haitian mother",
      anyOf: [
        { sourceKind: "vault", sourceId: "33933dae-f2d0-40a6-82d9-860ecffa49b5", locator: "¶1" },
        { sourceKind: "vault", sourceId: "797d7395-fd22-437b-ac9f-64cee8993373", locator: "¶1" },
      ],
    },
    {
      fact: "Jamaican and Panamanian father",
      anyOf: [
        { sourceKind: "vault", sourceId: "33933dae-f2d0-40a6-82d9-860ecffa49b5", locator: "¶1" },
        { sourceKind: "vault", sourceId: "797d7395-fd22-437b-ac9f-64cee8993373", locator: "¶1" },
      ],
    },
  ],
  "latasha-who-i-am-netflix": [
    {
      fact: "Self Made",
      anyOf: [
        { sourceKind: "vault", sourceId: "797d7395-fd22-437b-ac9f-64cee8993373", locator: "¶1" },
        { sourceKind: "vault", sourceId: "9362457d-0995-4e04-b3a3-06566ef5a354", locator: "¶1" },
      ],
    },
  ],
  "pete-rango-founded": [
    {
      fact: "XUE Records",
      anyOf: [
        { sourceKind: "social", sourceId: "213638ca-85c6-4a9b-bb46-1d33ee9ec6df", locator: "¶1" },
        { sourceKind: "vault", sourceId: "e3227d98-ad65-4259-97a7-5c13d6fcd8ac", locator: "¶1" },
      ],
    },
    {
      fact: "L.I.V.",
      anyOf: [
        { sourceKind: "social", sourceId: "feb83c5c-452b-4f37-8809-cf1ddc83c6cb", locator: "¶1" },
        { sourceKind: "vault", sourceId: "6177a5d3-d062-45c4-88d1-3f5c2eb2f851", locator: "¶1" },
        { sourceKind: "vault", sourceId: "e3227d98-ad65-4259-97a7-5c13d6fcd8ac", locator: "¶1" },
      ],
    },
    {
      fact: "Dead Set FC",
      anyOf: [
        { sourceKind: "vault", sourceId: "6177a5d3-d062-45c4-88d1-3f5c2eb2f851", locator: "¶1" },
      ],
    },
  ],
  "pete-rango-insecure-song": [
    {
      fact: "Vi$ions with Cherele on Insecure",
      anyOf: [
        { sourceKind: "vault", sourceId: "5877b614-7319-4be2-9dad-a7dfb87fe18b", locator: "¶1" },
      ],
    },
  ],
  "pete-rango-origin": [
    {
      fact: "born in Bogotá",
      anyOf: [
        { sourceKind: "vault", sourceId: "5877b614-7319-4be2-9dad-a7dfb87fe18b", locator: "¶1" },
      ],
    },
    {
      fact: "moved to Fairfax",
      anyOf: [
        { sourceKind: "vault", sourceId: "5877b614-7319-4be2-9dad-a7dfb87fe18b", locator: "¶1" },
      ],
    },
  ],
  "pete-rango-tv-placements": [
    {
      fact: "DTF St. Louis",
      anyOf: [
        { sourceKind: "vault", sourceId: "6177a5d3-d062-45c4-88d1-3f5c2eb2f851", locator: "¶1" },
      ],
    },
    {
      fact: "Rap Sh!t",
      anyOf: [
        { sourceKind: "vault", sourceId: "6177a5d3-d062-45c4-88d1-3f5c2eb2f851", locator: "¶1" },
      ],
    },
    {
      fact: "Sistas",
      anyOf: [
        { sourceKind: "vault", sourceId: "6177a5d3-d062-45c4-88d1-3f5c2eb2f851", locator: "¶1" },
      ],
    },
    {
      fact: "My Celebrity Dream Wedding",
      anyOf: [
        { sourceKind: "vault", sourceId: "6177a5d3-d062-45c4-88d1-3f5c2eb2f851", locator: "¶1" },
      ],
    },
    {
      fact: "Insecure",
      anyOf: [
        { sourceKind: "social", sourceId: "89d28e8b-f4f1-4028-96ff-edb0933c944c", locator: "¶1" },
        { sourceKind: "social", sourceId: "9519ff59-d09b-4c1f-b438-1316992086b8", locator: "¶1" },
        { sourceKind: "social", sourceId: "a752687c-9e58-425f-a583-174e376f8b63", locator: "¶1" },
        { sourceKind: "vault", sourceId: "5877b614-7319-4be2-9dad-a7dfb87fe18b", locator: "¶1" },
        { sourceKind: "vault", sourceId: "6177a5d3-d062-45c4-88d1-3f5c2eb2f851", locator: "¶1" },
      ],
    },
  ],
  "pete-rango-vcu-graduation": [],
  "sound-of-fractures-mother": [
    {
      fact: "Head of International at Island Records",
      anyOf: [
        { sourceKind: "vault", sourceId: "3a00eb49-7a20-4447-890c-1607d78edf00", locator: "¶1" },
      ],
    },
  ],
  "willie-colon-celia-cruz-albums": [
    {
      fact: "Only They Could Have Made This Album",
      anyOf: [
        { sourceKind: "vault", sourceId: "0430ffae-9e50-4f3d-82e3-4260b4627f48", locator: "¶1" },
        { sourceKind: "vault", sourceId: "1f85560d-934f-4852-82f6-8e0373241602", locator: "¶21" },
        { sourceKind: "vault", sourceId: "1f85560d-934f-4852-82f6-8e0373241602", locator: "¶23" },
        { sourceKind: "vault", sourceId: "dc9183b2-a4d5-4bcc-9bdb-0776b66c6774", locator: "¶1" },
      ],
    },
    {
      fact: "The Winners",
      anyOf: [
        { sourceKind: "vault", sourceId: "1f85560d-934f-4852-82f6-8e0373241602", locator: "¶23" },
      ],
    },
    {
      fact: "Celia & Willie",
      anyOf: [
        { sourceKind: "vault", sourceId: "85224932-a2db-4706-86b5-b45440d99534", locator: "¶249" },
      ],
    },
  ],
  "willie-colon-last-fight-year": [
    {
      fact: "1982 (Fania liner notes)",
      anyOf: [
        { sourceKind: "vault", sourceId: "1f85560d-934f-4852-82f6-8e0373241602", locator: "¶23" },
      ],
    },
    {
      fact: "1983 (LA Phil)",
      anyOf: [
        { sourceKind: "vault", sourceId: "0a56a8b7-20b3-4bfa-8443-c6c0f95d8973", locator: "¶1" },
        { sourceKind: "vault", sourceId: "1f85560d-934f-4852-82f6-8e0373241602", locator: "¶23" },
      ],
    },
  ],
  "willie-colon-toma-mis-manos": [
    {
      fact: "sister Cindy's death",
      anyOf: [
        { sourceKind: "vault", sourceId: "1f85560d-934f-4852-82f6-8e0373241602", locator: "¶23" },
      ],
    },
  ],
};
