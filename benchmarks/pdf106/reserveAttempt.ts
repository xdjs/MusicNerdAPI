import { existsSync, readFileSync, writeFileSync } from "node:fs";
/** Single serial runner; persist before submission, never retry an uncertain attempt. */
export function reserveAttempt(file: string, id: string): number {
  const ids: string[] = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
  if (!Array.isArray(ids) || ids.length >= 16 || ids.includes(id))
    throw new Error("Benchmark attempt limit or duplicate submission");
  ids.push(id);
  writeFileSync(file, JSON.stringify(ids), { mode: 0o600 });
  return ids.length;
}
