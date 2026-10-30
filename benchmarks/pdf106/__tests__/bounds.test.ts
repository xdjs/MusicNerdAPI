import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { reserveAttempt } from "../reserveAttempt";
import { sanitize } from "../sanitize";
import { CASES, SMOKE_CASES, PRIOR_ATTEMPTS } from "../cases";
it("retains attempts across cohorts, rejects repeats and the seventeenth submission", () => {
  const dir = mkdtempSync(join(tmpdir(), "pdf106-"));
  try {
    const file = join(dir, "ledger.json");
    for (let n = 0; n < 16; n++) expect(reserveAttempt(file, `case-${n}`)).toBe(n + 1);
    expect(() => reserveAttempt(file, "case-0")).toThrow();
    expect(() => reserveAttempt(file, "case-16")).toThrow();
  } finally {
    rmSync(dir, { recursive: true });
  }
});
it("redacts values and storage refs without losing the cited file path", () => {
  expect(
    sanitize("secret-123 https://example.supabase.co/vault/doc.pdf?token=abc Bearer abc.def", [
      "secret-123",
    ]),
  ).toBe("[REDACTED] https://[staging-storage]/vault/doc.pdf Bearer [REDACTED]");
});
it("freezes two normal and two PDF cases: twice per cohort totals sixteen", () => {
  expect(CASES.filter(c => c.key.startsWith("normal"))).toHaveLength(2);
  expect(CASES.filter(c => c.key.startsWith("pdf"))).toHaveLength(2);
  expect(CASES.length * 2 * 2).toBe(16);
});

it("smoke mode has only two PDF questions and carries forward eight spent attempts", () => {
  expect(SMOKE_CASES).toHaveLength(2);
  expect(
    SMOKE_CASES.every(c => c.key.startsWith("pdf-smoke") && c.artistName === "Pete Rango"),
  ).toBe(true);
  expect(new Set(PRIOR_ATTEMPTS).size).toBe(8);
  const dir = mkdtempSync(join(tmpdir(), "pdf106-smoke-"));
  try {
    const file = join(dir, "ledger.json");
    writeFileSync(file, JSON.stringify(PRIOR_ATTEMPTS));
    let count = 8;
    for (const cohort of ["baseline", "candidate"])
      for (const c of SMOKE_CASES)
        for (const repeat of ["first", "repeated"])
          expect(reserveAttempt(file, `${cohort}:${c.key}:${repeat}`)).toBe(++count);
    expect(count).toBe(16);
    expect(() => reserveAttempt(file, "replacement")).toThrow();
  } finally {
    rmSync(dir, { recursive: true });
  }
});
