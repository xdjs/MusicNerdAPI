/** Per-account correction reports in a rolling 24-hour window. */
export const BIO_CORRECTION_REPORT_LIMIT = 10;

/** The longest raw report body accepted, in characters. */
export const BIO_CORRECTION_MAX_BODY = 18_000;

/** What a report may say is wrong with the About. */
export const BIO_CORRECTION_REASONS = ["wrong_artist", "incorrect", "outdated", "other"] as const;
