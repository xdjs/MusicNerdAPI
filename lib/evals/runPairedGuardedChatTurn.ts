import { createHash } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { runSingleGuardedChatTurn } from "./runSingleGuardedChatTurn";

/** Private, interactive runner only. A hash-pinned enabled pair manifest is still required. */
export async function runPairedGuardedChatTurn(manifestPath: string) {
  if (process.stdin.isTTY !== true || process.stdout.isTTY !== true)
    throw new Error("pair_private_terminal_required");
  return runSingleGuardedChatTurn(manifestPath, {
    conversation: {
      async reviewFirst(turn, message, signal) {
        // A private terminal is required: never send answers or source evidence to CI logs.
        // JSON escapes terminal control sequences from untrusted model/source text.
        const output = JSON.stringify({ firstTurn: turn, clientMessage: message });
        const digest = createHash("sha256").update(output).digest("hex");
        const acceptance = `PASS FIRST ANSWER ${digest}`;
        process.stdout.write(output + "\n");
        const terminal = createInterface({ input: process.stdin, output: process.stdout });
        try {
          const answer = await terminal.question(
            `Review source-page support, alias dates/overlap and uncertainty. Transport success is not quality. Type ${acceptance} to accept this exact output and admit the pinned follow-up, or anything else to stop: `,
            { signal },
          );
          return answer === acceptance ? "pass" : "unscored";
        } finally {
          terminal.close();
        }
      },
    },
  });
}
