import { APICallError, RetryError } from "ai";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { EmbeddingInputError } from "@/lib/units/EmbeddingInputError";
import { MODEL_EMBEDDING } from "@/lib/ai/const";
import {
  EMBED_BATCH,
  EMBED_BATCH_CHARS,
  EMBED_INPUT_CHARS,
  EMBEDDING_DIMENSIONS,
} from "@/lib/units/types";

vi.mock("ai", async importOriginal => ({
  ...(await importOriginal<typeof import("ai")>()),
  embedMany: vi.fn(),
}));
const { embedMany } = await import("ai");
const { embedUnits } = await import("@/lib/units/embedUnits");
const embedManyMock = vi.mocked(embedMany) as unknown as ReturnType<typeof vi.fn>;

const apiError = (statusCode?: number) =>
  new APICallError({ message: "m", url: "https://x.example", requestBodyValues: {}, statusCode });

/** A full-length vector whose first component identifies the input. */
const vec = (marker: number) => {
  const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  v[0] = marker;
  return v;
};

beforeEach(() => {
  embedManyMock.mockReset();
});

describe("embedUnits", () => {
  test("batches by EMBED_BATCH and preserves order across batches", async () => {
    const texts = Array.from({ length: EMBED_BATCH + 1 }, (_, i) => `t${i}`);
    embedManyMock.mockImplementation(async (args: { values: string[] }) => {
      return { embeddings: args.values.map(t => vec(Number(t.slice(1)))) };
    });

    const out = await embedUnits(texts);

    expect(embedManyMock).toHaveBeenCalledTimes(2);
    expect(embedManyMock.mock.calls[0][0].values).toEqual(texts.slice(0, EMBED_BATCH));
    expect(embedManyMock.mock.calls[1][0].values).toEqual(texts.slice(EMBED_BATCH));
    expect(embedManyMock.mock.calls[0][0].model).toBe(MODEL_EMBEDDING);
    expect(out).toHaveLength(texts.length);
    expect(out.map(v => v[0])).toEqual(texts.map((_, i) => i));
  });

  test("throws when a vector has the wrong dimension", async () => {
    embedManyMock.mockResolvedValue({ embeddings: [[1, 2, 3]] });
    await expect(embedUnits(["a"])).rejects.toThrow(/dimension/i);
  });

  test("throws when the model returns a different number of vectors than inputs", async () => {
    embedManyMock.mockResolvedValue({ embeddings: [vec(1)] });
    await expect(embedUnits(["a", "b"])).rejects.toThrow(/2.*1|1.*2/);
  });

  test("returns [] without calling the model for empty input", async () => {
    await expect(embedUnits([])).resolves.toEqual([]);
    expect(embedManyMock).not.toHaveBeenCalled();
  });

  test("forwards the abort signal", async () => {
    embedManyMock.mockResolvedValue({ embeddings: [vec(1)] });
    const signal = new AbortController().signal;
    await embedUnits(["a"], { signal });
    expect(embedManyMock.mock.calls[0][0].abortSignal).toBe(signal);
  });

  test("splits 40 page-sized inputs into several requests within both limits, in order", async () => {
    const texts = Array.from({ length: 40 }, (_, i) =>
      String.fromCharCode(65 + (i % 26)).repeat(24_000),
    );
    embedManyMock.mockImplementation(async (args: { values: string[] }) => ({
      embeddings: args.values.map(t => vec(t.charCodeAt(0))),
    }));

    const out = await embedUnits(texts);

    expect(embedManyMock.mock.calls.length).toBeGreaterThan(1);
    let sent = 0;
    for (const [args] of embedManyMock.mock.calls) {
      const values = args.values as string[];
      expect(values.length).toBeLessThanOrEqual(EMBED_BATCH);
      expect(values.reduce((n, v) => n + v.length, 0)).toBeLessThanOrEqual(EMBED_BATCH_CHARS);
      sent += values.length;
    }
    expect(sent).toBe(40);
    expect(out.map(v => v[0])).toEqual(texts.map(t => t.charCodeAt(0)));
  });

  test("sends one oversized input cut to EMBED_INPUT_CHARS", async () => {
    embedManyMock.mockResolvedValue({ embeddings: [vec(1)] });
    await embedUnits(["x".repeat(30_000)]);
    expect(embedManyMock.mock.calls[0][0].values[0].length).toBeLessThanOrEqual(EMBED_INPUT_CHARS);
  });

  test("cuts at the last whitespace when one is in the final 200 characters", async () => {
    const text = "a".repeat(EMBED_INPUT_CHARS - 50) + " " + "b".repeat(100);
    embedManyMock.mockResolvedValue({ embeddings: [vec(1)] });
    await embedUnits([text]);
    expect(embedManyMock.mock.calls[0][0].values[0]).toBe("a".repeat(EMBED_INPUT_CHARS - 50));
  });

  test("hard-cuts when there is no whitespace near the limit", async () => {
    embedManyMock.mockResolvedValue({ embeddings: [vec(1)] });
    await embedUnits(["a".repeat(100) + " " + "b".repeat(EMBED_INPUT_CHARS)]);
    expect(embedManyMock.mock.calls[0][0].values[0]).toHaveLength(EMBED_INPUT_CHARS);
  });

  test("splits a failing batch of 16 in halves and keeps order", async () => {
    const texts = Array.from({ length: 16 }, (_, i) => `t${i}`);
    embedManyMock.mockRejectedValueOnce(apiError(400));
    embedManyMock.mockImplementation(async (args: { values: string[] }) => ({
      embeddings: args.values.map(t => vec(Number(t.slice(1)))),
    }));

    const out = await embedUnits(texts);

    expect(embedManyMock).toHaveBeenCalledTimes(3);
    expect(out.map(v => v[0])).toEqual(texts.map((_, i) => i));
  });

  test("isolates one bad input and names its position without its text", async () => {
    const texts = ["a0", "a1", "secret2", "a3", "a4"];
    const badInput = apiError(422);
    embedManyMock.mockImplementation(async (args: { values: string[] }) => {
      if (args.values.includes("secret2")) throw badInput;
      return { embeddings: args.values.map(() => vec(1)) };
    });

    const error = await embedUnits(texts).catch(e => e);

    expect(error).toBeInstanceOf(EmbeddingInputError);
    expect(error).toMatchObject({ index: 2, total: 5 });
    expect(error.message).not.toContain("secret2");
    expect(error.cause).toBe(badInput);
    expect(embedManyMock.mock.calls.length).toBeGreaterThan(2);
  });

  test("does not split when the signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    embedManyMock.mockRejectedValue(new Error("aborted"));
    await expect(embedUnits(["a", "b"], { signal: controller.signal })).rejects.toThrow("aborted");
    expect(embedManyMock).toHaveBeenCalledTimes(1);
  });

  test("does not split an abort error thrown without an aborted signal", async () => {
    const abort = new DOMException("aborted", "AbortError");
    embedManyMock.mockRejectedValue(abort);
    await expect(embedUnits(["a", "b"])).rejects.toBe(abort);
    expect(embedManyMock).toHaveBeenCalledTimes(1);
  });

  test("rethrows a 429 from a 16-input batch after exactly one call", async () => {
    const texts = Array.from({ length: 16 }, (_, i) => `t${i}`);
    const limited = apiError(429);
    embedManyMock.mockRejectedValue(limited);
    await expect(embedUnits(texts)).rejects.toBe(limited);
    expect(embedManyMock).toHaveBeenCalledTimes(1);
  });

  test("splits a 16-input batch for a 400 and names the failing index", async () => {
    const texts = Array.from({ length: 16 }, (_, i) => (i === 11 ? "bad" : `t${i}`));
    embedManyMock.mockImplementation(async (args: { values: string[] }) => {
      if (args.values.includes("bad")) throw apiError(400);
      return { embeddings: args.values.map(() => vec(1)) };
    });
    const error = await embedUnits(texts).catch(e => e);
    expect(error).toBeInstanceOf(EmbeddingInputError);
    expect(error).toMatchObject({ index: 11, total: 16 });
  });

  test("splits for a non-retryable retry error with a 400", async () => {
    const wrapped = new RetryError({
      message: "m",
      reason: "errorNotRetryable",
      errors: [apiError(400)],
    });
    embedManyMock.mockRejectedValue(wrapped);
    const error = await embedUnits(["a", "b"]).catch(e => e);
    expect(error).toBeInstanceOf(EmbeddingInputError);
    expect(embedManyMock).toHaveBeenCalledTimes(2);
  });

  test("does not split a retry-exhausted 500", async () => {
    const exhausted = new RetryError({
      message: "m",
      reason: "maxRetriesExceeded",
      errors: [apiError(500)],
    });
    embedManyMock.mockRejectedValue(exhausted);
    await expect(embedUnits(["a", "b", "c", "d"])).rejects.toBe(exhausted);
    expect(embedManyMock).toHaveBeenCalledTimes(1);
  });

  test("does not split an error without a status", async () => {
    const failure = new Error("approved request/spend envelope exhausted");
    embedManyMock.mockRejectedValue(failure);
    await expect(embedUnits(["a", "b"])).rejects.toBe(failure);
    expect(embedManyMock).toHaveBeenCalledTimes(1);
  });
});
