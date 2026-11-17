/**
 * Staging (Music Nerd Dev) artists the eval suites use. Every id here is a STAGING id; production
 * ids differ. Previews and the evals read the staging database.
 */
export const BIO_RITMO = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
export const WILLIE_COLON = "ddba2de8-117e-4e90-8d56-ef61b4b858ae";
export const DUTCHYYY = "6cb3d81a-3d02-4c57-a711-bb7902a9af1b";
/** The catalog record (streaming and social links, own posts). */
export const LATASHA = "73488cf7-3d3f-46ac-8cb1-74424c162ed6";
/** A second staging record under the same name that holds its own approved documents. */
export const LATASHA_DOCUMENTS = "03dca409-d89d-4183-9452-0374e81d84ee";
export const PETE_RANGO = "50f23458-df64-4381-8042-7333e8b64531";
export const CELIA_CRUZ = "e6b540c3-b59b-43d3-ab8b-b153c1e6ab5f";
export const JORDAN_REIN = "e983a3c4-e209-4926-8fa7-0b6ab3d5e8ab";
export const SOUND_OF_FRACTURES = "e3eaace6-73f5-452b-86e6-a14542081a30";

/** Every artist whose sources the `units-backfill` suite indexes before the chat and retrieval suites run. */
export const EVAL_ARTIST_IDS = [
  BIO_RITMO,
  WILLIE_COLON,
  DUTCHYYY,
  LATASHA,
  LATASHA_DOCUMENTS,
  PETE_RANGO,
  CELIA_CRUZ,
  JORDAN_REIN,
  SOUND_OF_FRACTURES,
];
