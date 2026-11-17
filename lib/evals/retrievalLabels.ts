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
};
