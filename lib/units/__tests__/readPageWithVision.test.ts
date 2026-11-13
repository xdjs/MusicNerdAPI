import { beforeEach, describe, expect, test, vi } from "vitest";
import { MODEL_OCR } from "@/lib/ai/const";

const generateTextMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/generateText", () => ({ generateText: generateTextMock }));
const { readPageWithVision } = await import("@/lib/units/readPageWithVision");

beforeEach(() => generateTextMock.mockReset());

describe("readPageWithVision", () => {
  test("sends the page as a file part and returns the text", async () => {
    generateTextMock.mockResolvedValue({ text: "## Title\nBody" });
    await expect(readPageWithVision(new Uint8Array([37, 80, 68, 70]))).resolves.toBe(
      "## Title\nBody",
    );
    const call = generateTextMock.mock.calls[0][0];
    expect(call.model).toBe(MODEL_OCR);
    expect(call.prompt[0].role).toBe("user");
    expect(call.prompt[0].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "file", mediaType: "application/pdf" }),
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("Transcribe every word"),
        }),
      ]),
    );
  });

  test("trims the transcription and forwards the signal and model override", async () => {
    generateTextMock.mockResolvedValue({ text: "\n  Hello  \n" });
    const signal = AbortSignal.timeout(1000);
    await expect(
      readPageWithVision(new Uint8Array([1]), { signal, model: "google/other" }),
    ).resolves.toBe("Hello");
    expect(generateTextMock.mock.calls[0][0]).toMatchObject({
      model: "google/other",
      abortSignal: signal,
    });
  });

  test("rejects an empty transcription", async () => {
    generateTextMock.mockResolvedValue({ text: "  " });
    await expect(readPageWithVision(new Uint8Array([1]))).rejects.toThrow(/empty/i);
  });
});
