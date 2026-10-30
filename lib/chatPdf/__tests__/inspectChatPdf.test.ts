import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Worker } from "node:worker_threads";
import { expect, it, vi } from "vitest";
const workers = vi.hoisted(() => [] as Worker[]);
vi.mock("node:worker_threads", async original => {
  const actual = await original<typeof import("node:worker_threads")>();
  return {
    ...actual,
    Worker: class extends actual.Worker {
      constructor(...args: ConstructorParameters<typeof actual.Worker>) {
        super(...args);
        workers.push(this);
      }
    },
  };
});
const { inspectChatPdf } = await import("@/lib/chatPdf/inspectChatPdf");

it("terminates a demonstrably running synchronous parser while the request event loop remains live", async () => {
  const cancel = new AbortController();
  const reading = inspectChatPdf(
    new Uint8Array(),
    cancel.signal,
    fileURLToPath(new URL("./fixtures/busyParser.cjs", import.meta.url)),
  );
  const rejected = expect(reading).rejects.toThrow("cancelled");
  const worker = workers.at(-1)!;
  await new Promise<void>(resolve =>
    worker.on("message", m => {
      if (m.type === "test-started") resolve();
    }),
  );
  const start = performance.now();
  await new Promise(resolve => setTimeout(resolve, 30));
  cancel.abort();
  await rejected;
  expect(performance.now() - start).toBeLessThan(1000);
  expect(worker.threadId).toBe(-1);
}, 10000);

it("contains parser heap exhaustion in the worker", async () => {
  const reading = inspectChatPdf(
    new Uint8Array(),
    AbortSignal.timeout(5000),
    fileURLToPath(new URL("./fixtures/heapParser.cjs", import.meta.url)),
  );
  await expect(reading).rejects.toThrow(/memory/i);
  expect(workers.at(-1)!.threadId).toBe(-1);
}, 10000);

it("returns actual PDF metadata and disposes the worker", async () => {
  const bytes = readFileSync(
    new URL("../../vaultUpload/__tests__/fixtures/text.pdf", import.meta.url),
  );
  expect(await inspectChatPdf(bytes, AbortSignal.timeout(3000))).toBe(1);
  expect(workers.at(-1)!.threadId).toBe(-1);
});
