import { assertPairedChatBundle } from "@/lib/evals/assertPairedChatBundle";

// Not registered with Evals or CI. Requires a private terminal and fresh pair authorization.
async function main() {
  // Bundled CJS only. Verify the bytes being executed before importing provider/DB boundaries.
  if (typeof __filename !== "string") throw new Error("pair_bundle_required");
  assertPairedChatBundle(__filename, process.env.CHAT_PAIR_BUNDLE_SHA256);
  const path = process.env.CHAT_PAIR_MANIFEST;
  if (!path) throw new Error("pair_manifest_missing");
  const { runPairedGuardedChatTurn } = await import("@/lib/evals/runPairedGuardedChatTurn");
  const result = await runPairedGuardedChatTurn(path);
  if (!("stopped" in result)) throw new Error("pair_result_missing");
  process.stdout.write(JSON.stringify({ stopped: result.stopped, invoiceGuarantee: false }) + "\n");
}
void main().catch(() => {
  process.stderr.write("CHAT_PAIR_STOPPED: inspect the private ledger; no retry is authorized.\n");
  process.exitCode = 1;
});
