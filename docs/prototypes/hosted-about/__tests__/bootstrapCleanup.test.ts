import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { cleanupOwnedBootstrap } from "../bootstrap-cleanup.mjs";
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "mn-cleanup-test-")),
    data = join(root, "data"),
    marker = "test-marker";
  mkdirSync(data);
  writeFileSync(join(root, "owner-marker"), marker);
  writeFileSync(join(data, "postmaster.pid"), `12345\n${data}\n`);
  return { root, data, marker, attemptedStart: true };
}
it("stops a verified owned server even when pg_ctl start previously failed or timed out", () => {
  const f = fixture();
  try {
    const pgCtl = vi
      .fn()
      .mockReturnValueOnce({ status: 0, stdout: "pg_ctl: server is running (PID: 12345)" })
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 3 });
    expect(cleanupOwnedBootstrap({ ...f, pgCtl })).toEqual({ state: "stopped" });
    expect(pgCtl.mock.calls[1][0]).toEqual(["-D", f.data, "-m", "fast", "-w", "stop"]);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
it.each([
  ["unknown", 1, ""],
  ["pid mismatch", 0, "pg_ctl: server is running (PID: 555)"],
])("does not stop on %s identity/status", (_name, status, stdout) => {
  const f = fixture();
  try {
    const pgCtl = vi.fn(() => ({ status, stdout }));
    expect(() => cleanupOwnedBootstrap({ ...f, pgCtl })).toThrow();
    expect(pgCtl).toHaveBeenCalledTimes(1);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
it("reports not-running after a failed start only when pg_ctl confirms no server", () => {
  const f = fixture();
  try {
    const pgCtl = vi.fn(() => ({ status: 3 }));
    expect(cleanupOwnedBootstrap({ ...f, pgCtl })).toEqual({ state: "not-running" });
    expect(pgCtl).toHaveBeenCalledTimes(1);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
it("does not claim a successful cleanup when stop fails", () => {
  const f = fixture();
  try {
    const pgCtl = vi
      .fn()
      .mockReturnValueOnce({ status: 0, stdout: "pg_ctl: server is running (PID: 12345)" })
      .mockReturnValueOnce({ status: 1 });
    expect(() => cleanupOwnedBootstrap({ ...f, pgCtl })).toThrow("cleanup uncertain");
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
