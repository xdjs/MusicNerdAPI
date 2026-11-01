import { expect, it } from "vitest";
import { createOfflineChatTrace } from "./helpers/createOfflineChatTrace";

it("consumes a request once, including concurrent or failed attempts", () => {
  const trace = createOfflineChatTrace();
  trace.begin("request-1");
  expect(() => trace.begin("request-1")).toThrow("already_started");
  expect(trace.snapshot().failure).toBe("already_started");
});

it("stops before step seven without truncating recorded evidence", () => {
  const trace = createOfflineChatTrace();
  trace.begin("one");
  for (let i = 0; i < 6; i++) trace.modelStep({ prompt: [{ text: `step${i}` }] });
  expect(() => trace.modelStep({ prompt: [] })).toThrow("step_limit");
  expect(trace.snapshot().steps).toBe(6);
});

it("fails closed on oversized input or capture and retains a failure status", () => {
  const input = createOfflineChatTrace();
  input.begin("input");
  expect(() => input.modelStep({ prompt: "x".repeat(128001) })).toThrow("input_limit");
  expect(input.snapshot().steps).toBe(0);
  const capture = createOfflineChatTrace();
  capture.begin("capture");
  expect(() => capture.record("data", "x".repeat(1_000_001))).toThrow("capture_limit");
  expect(capture.snapshot().failure).toBe("capture_limit");
});

it("copies snapshots, rejects unbounded output, and never resumes after failure", () => {
  const trace = createOfflineChatTrace();
  trace.begin("one");
  const value = { text: "original" };
  trace.record("read", value);
  value.text = "changed";
  expect(trace.snapshot().events[1].value).toEqual({ text: "original" });
  expect(() => trace.output("x".repeat(8193))).toThrow("output_limit");
  expect(() => trace.modelStep({ prompt: [] })).toThrow("output_limit");
});
