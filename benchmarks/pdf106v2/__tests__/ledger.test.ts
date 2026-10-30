import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it, expect } from "vitest";
import { ledger } from "../ledger";
it("persists exactly three answers across fresh runner instances and refuses replacements", () => {
  const dir = mkdtempSync(join(tmpdir(), "pdfv2-ledger-"));
  try {
    const file = join(dir, "ledger.json");
    for (let i = 0; i < 3; i++) {
      const b = ledger(file, "manifest");
      expect(b.reserve(`case-${i}`)).toBe(i + 1);
      b.finish(`case-${i}`, false);
    }
    expect(() => ledger(file, "manifest").reserve("case-3")).toThrow();
    expect(() => ledger(file, "different-manifest").read()).toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it("keeps uncertain and failed attempts in the denominator and stops further submissions", () => {
  const dir = mkdtempSync(join(tmpdir(), "pdfv2-failed-"));
  try {
    const b = ledger(join(dir, "ledger.json"), "manifest");
    b.reserve("timed-out");
    expect(() => b.reserve("replacement")).toThrow();
    b.finish("timed-out", true, "timeout");
    expect(b.read().attempts).toHaveLength(1);
    expect(b.read().halted).toBe(true);
    expect(() => b.reserve("new")).toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it("reserves every model egress before sending and bounds model/tool requests independently", () => {
  const dir = mkdtempSync(join(tmpdir(), "pdfv2-egress-"));
  try {
    const b = ledger(join(dir, "ledger.json"), "manifest");
    expect(() => b.egress("model")).toThrow();
    b.reserve("active");
    for (let i = 0; i < 18; i++) b.egress("model");
    expect(() => b.egress("model")).toThrow();
    expect(() => b.egress("web")).toThrow();
    expect(b.read()).toMatchObject({ modelRequests: 18, webRequests: 0 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
