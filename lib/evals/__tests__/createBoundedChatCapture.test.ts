import { expect, it, vi } from "vitest";
import { createBoundedChatCapture } from "../createBoundedChatCapture";

it("counts exact UTF-8 JSONL bytes including newlines across both event producers", () => {
  const line = JSON.stringify({ kind: "model-input", value: "界🙂" }) + "\n";
  const write = vi.fn();
  const capture = createBoundedChatCapture({ maxBytes: Buffer.byteLength(line), write });
  capture.record("model-input", "界🙂");
  expect(write).toHaveBeenCalledWith(line);
  expect(capture.snapshot()).toMatchObject({ writtenBytes: Buffer.byteLength(line) });
  expect(() => capture.record("server-tool-event", {})).toThrow("eval_capture_limit");
  expect(write).toHaveBeenCalledTimes(1);
  expect(capture.signal.aborted).toBe(true);
  expect(() => capture.record("terminal", {})).toThrow("eval_capture_limit");
});

it("reserves before a synchronous sink write and never refunds failed or uncertain writes", () => {
  const write = vi.fn(() => {
    throw new Error("private details must not enter the receipt");
  });
  const capture = createBoundedChatCapture({ maxBytes: 4096, write });
  expect(() => capture.record("model-input", "fixture")).toThrow("eval_capture_write");
  expect(capture.snapshot()).toMatchObject({ writtenBytes: 0, failure: "eval_capture_write" });
  expect(capture.snapshot().reservedBytes).toBeGreaterThan(0);
  expect(JSON.stringify(capture.snapshot())).not.toContain("private details");
  expect(() => capture.record("model-input", "again")).toThrow("eval_capture_write");
  expect(write).toHaveBeenCalledTimes(1);
});

it("rejects invalid ceilings, encoding and asynchronous sinks without continuing", () => {
  for (const maxBytes of [0, 4194305, 1.5, NaN])
    expect(() => createBoundedChatCapture({ maxBytes, write: () => {} })).toThrow();
  const capture = createBoundedChatCapture({ maxBytes: 4096, write: () => {} });
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  expect(() => capture.record("model-input", cyclic)).toThrow("eval_capture_encoding");
  expect(capture.signal.aborted).toBe(true);
  const asyncSink = createBoundedChatCapture({
    maxBytes: 4096,
    write: (() => Promise.resolve()) as never,
  });
  expect(() => asyncSink.record("request", {})).toThrow("eval_capture_write");
  expect(asyncSink.signal.aborted).toBe(true);
});

it("charges concurrent synchronous admissions against one ledger", async () => {
  const line = JSON.stringify({ kind: "ui-chunk", value: "fixture" }) + "\n";
  const write = vi.fn();
  const capture = createBoundedChatCapture({ maxBytes: Buffer.byteLength(line) * 2, write });
  const outcomes = await Promise.allSettled(
    [1, 2, 3].map(() => Promise.resolve().then(() => capture.record("ui-chunk", "fixture"))),
  );
  expect(outcomes.filter(r => r.status === "fulfilled")).toHaveLength(2);
  expect(write).toHaveBeenCalledTimes(2);
  expect(capture.snapshot().writtenBytes).toBe(Buffer.byteLength(line) * 2);
});

it("accounts exactly when a synchronous sink also emits a nested capture event", () => {
  const lines: string[] = [];
  const capture = createBoundedChatCapture({
    maxBytes: 4096,
    write: (line: string): void => {
      if (JSON.parse(line).kind === "outer") capture.record("inner", "short");
      lines.push(line);
    },
  });
  capture.record("outer", "a longer event with a different byte size");
  expect(capture.snapshot().writtenBytes).toBe(Buffer.byteLength(lines.join("")));
  expect(capture.snapshot().reservedBytes).toBe(capture.snapshot().writtenBytes);
});
