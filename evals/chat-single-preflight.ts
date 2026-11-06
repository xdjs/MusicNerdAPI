import { runSingleGuardedChatTurn } from "@/lib/evals/runSingleGuardedChatTurn";

// Standalone read-only entrypoint: never imports Braintrust or registers/runs an Eval.
async function main() {
  const path = process.env.CHAT_SINGLE_MANIFEST;
  if (!path) throw new Error("single_manifest_missing");
  const result = await runSingleGuardedChatTurn(path, { preflightOnly: true });
  if (!("preflight" in result)) throw new Error("single_preflight_missing");
  console.log(
    JSON.stringify({
      code: "CHAT_SINGLE_PREFLIGHT_READ_COMPLETE",
      ...result.preflight,
      modelCalls: 0,
      quotaReservations: 0,
    }),
  );
}
void main().catch(() => {
  console.error("CHAT_SINGLE_PREFLIGHT_FAILED: no configuration values emitted");
  process.exitCode = 1;
});
