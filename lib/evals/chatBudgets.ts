/**
 * Time to the first signal a fan sees (the status line while the model reads) the chat
 * should meet. Text within this time is not a requirement: answers that read or research
 * take longer.
 */
export const FIRST_SIGNAL_BUDGET_MS = 5_000;

/**
 * Total time for a finished answer: Pete's question at the 2026-10-27 stand-up took nearly
 * 20 s, which #1629 treats as the ceiling the replacement must not exceed.
 */
export const TOTAL_BUDGET_MS = 20_000;

/**
 * The most the mean answer time over a run's questions may be. Staging 2026-11-14: the mean was
 * 5.5 s over 75 rows (90th percentile 7.9 s, slowest 12.4 s). The 20 s per-answer limit stays.
 */
export const MEAN_TOTAL_BUDGET_MS = 8_000;
