/** One place a record can be heard. */
export type TrackLink = { service: string; url: string };

/** A provider's answer: `null` is "searched, no match"; `undefined` is "could
 *  not search". The difference decides whether the answer is worth caching. */
export type TrackLookup = TrackLink | null | undefined;
