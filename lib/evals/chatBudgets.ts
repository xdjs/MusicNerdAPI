/**
 * Time to first text the chat should meet: #1629's goal is text "within a few seconds" of
 * asking. Today's path shows nothing until the whole answer arrives, so its baseline is
 * expected to miss this.
 */
export const FIRST_TEXT_BUDGET_MS = 5_000;

/**
 * Total time for a finished answer: Pete's question at the 2026-10-27 stand-up took nearly
 * 20 s, which #1629 treats as the ceiling the replacement must not exceed.
 */
export const TOTAL_BUDGET_MS = 20_000;
