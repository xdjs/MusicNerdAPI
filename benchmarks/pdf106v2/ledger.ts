import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  openSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { dirname } from "node:path";
export type Ledger = {
  version: 4;
  manifest: string;
  attempts: { id: string; outcome: "started" | "completed" | "failed"; detail?: string }[];
  modelRequests: number;
  webRequests: number;
  halted: boolean;
};
export function ledger(file: string, manifest: string) {
  const read = (): Ledger => {
    const s: Ledger = existsSync(file)
      ? JSON.parse(readFileSync(file, "utf8"))
      : { version: 4, manifest, attempts: [], modelRequests: 0, webRequests: 0, halted: false };
    if (
      s.version !== 4 ||
      s.manifest !== manifest ||
      !Array.isArray(s.attempts) ||
      s.attempts.length > 4
    )
      throw Error("Ledger mismatch");
    return s;
  };
  const save = (s: Ledger) => {
    const tmp = file + ".tmp";
    writeFileSync(tmp, JSON.stringify(s, null, 2), { mode: 0o600 });
    const fd = openSync(tmp, "r");
    fsyncSync(fd);
    closeSync(fd);
    renameSync(tmp, file);
    const dir = openSync(dirname(file), "r");
    fsyncSync(dir);
    closeSync(dir);
  };
  return {
    read,
    reserve(id: string) {
      const s = read();
      if (
        s.halted ||
        s.attempts.some(a => a.outcome === "started") ||
        s.attempts.length >= 4 ||
        s.attempts.some(a => a.id === id)
      )
        throw Error("No replacement or excess submissions");
      s.attempts.push({ id, outcome: "started" });
      save(s);
      return s.attempts.length;
    },
    finish(id: string, failed: boolean, detail?: string) {
      const s = read();
      const a = s.attempts.find(x => x.id === id);
      if (!a || a.outcome !== "started") throw Error("Attempt state mismatch");
      a.outcome = failed ? "failed" : "completed";
      a.detail = detail;
      if (failed) s.halted = true;
      save(s);
    },
    egress(kind: "model" | "web") {
      const s = read();
      const field = kind === "model" ? "modelRequests" : "webRequests";
      if (
        s.halted ||
        !s.attempts.some(a => a.outcome === "started") ||
        s[field] >= (kind === "model" ? 24 : 0)
      )
        throw Error("Egress limit");
      s[field]++;
      save(s);
    },
    halt() {
      const s = read();
      s.halted = true;
      save(s);
    },
  };
}
