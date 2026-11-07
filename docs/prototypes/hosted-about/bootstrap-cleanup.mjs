import assert from "node:assert/strict";
import { readFileSync, existsSync, realpathSync } from "node:fs";
import { join } from "node:path";

/** Check uncertain starts and stop only this runner's marker-bound data directory. */
export function cleanupOwnedBootstrap({ root, data, marker, attemptedStart, pgCtl }) {
  assert.equal(
    readFileSync(join(root, "owner-marker"), "utf8"),
    marker,
    "Owned cluster marker changed",
  );
  if (!attemptedStart) return { state: "not-started" };
  const status = pgCtl(["-D", data, "status"]);
  if (status.status === 3) return { state: "not-running" };
  if (status.status !== 0)
    throw new Error("Cannot determine owned PostgreSQL status; cleanup uncertain");
  const pidPath = join(data, "postmaster.pid");
  assert(existsSync(pidPath), "Running status without owned PID file; cleanup uncertain");
  const lines = readFileSync(pidPath, "utf8").split("\n");
  assert.match(lines[0], /^[1-9][0-9]*$/, "Invalid owned PostgreSQL PID");
  assert.equal(realpathSync(lines[1]), realpathSync(data), "Postmaster data directory mismatch");
  const reported = String(status.stdout).match(/\(PID:\s*([0-9]+)\)/)?.[1];
  assert.equal(reported, lines[0], "Postmaster PID/status mismatch");
  // Recheck marker immediately before a control action. No arbitrary PID is signaled.
  assert.equal(readFileSync(join(root, "owner-marker"), "utf8"), marker);
  const stop = pgCtl(["-D", data, "-m", "fast", "-w", "stop"]);
  if (stop.status !== 0) throw new Error("Owned PostgreSQL stop failed; cleanup uncertain");
  const after = pgCtl(["-D", data, "status"]);
  if (after.status !== 3) throw new Error("Owned PostgreSQL stop not confirmed; cleanup uncertain");
  return { state: "stopped" };
}
