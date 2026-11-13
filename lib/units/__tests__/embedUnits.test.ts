import { beforeEach, describe, expect, test, vi } from "vitest";
import { MODEL_EMBEDDING } from "@/lib/ai/const";
import { EMBED_BATCH, EMBEDDING_DIMENSIONS } from "@/lib/units/types";

vi.mock("ai", () => ({ embedMany: vi.fn() }));
const { embedMany } = await import("ai");
const { embedUnits } = await import("@/lib/units/embedUnits");
const embedManyMock = vi.mocked(embedMany) as unknown as ReturnType<typeof vi.fn>;

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
});
