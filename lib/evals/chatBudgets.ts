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
