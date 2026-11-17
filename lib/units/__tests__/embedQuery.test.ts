import { beforeEach, describe, expect, test, vi } from "vitest";
import { MODEL_EMBEDDING } from "@/lib/ai/const";
import { EMBED_INPUT_CHARS, EMBEDDING_DIMENSIONS } from "@/lib/units/types";

vi.mock("ai", () => ({ embed: vi.fn() }));
const { embed } = await import("ai");
const { embedQuery } = await import("@/lib/units/embedQuery");
const embedMock = vi.mocked(embed) as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => embedMock.mockReset());

describe("embedQuery", () => {
  test("embeds the text once with the embedding model and forwards the signal", async () => {
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0.5);
    embedMock.mockResolvedValue({ embedding: vector });
    const signal = new AbortController().signal;
    expect(await embedQuery("first tour", { signal })).toBe(vector);
    expect(embedMock).toHaveBeenCalledOnce();
    expect(embedMock.mock.calls[0][0]).toEqual({
      model: MODEL_EMBEDDING,
      value: "first tour",
      abortSignal: signal,
    });
  });

  test("throws when the vector has the wrong dimension", async () => {
    embedMock.mockResolvedValue({ embedding: [1, 2, 3] });
    await expect(embedQuery("x")).rejects.toThrow(/dimension/i);
  });

  test("cuts an oversized query to EMBED_INPUT_CHARS", async () => {
    embedMock.mockResolvedValue({ embedding: new Array<number>(EMBEDDING_DIMENSIONS).fill(0) });
    await embedQuery("q".repeat(EMBED_INPUT_CHARS + 500));
    expect(embedMock.mock.calls[0][0].value).toHaveLength(EMBED_INPUT_CHARS);
  });
});
