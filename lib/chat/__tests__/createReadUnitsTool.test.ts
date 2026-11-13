import { beforeEach, describe, expect, test, vi } from "vitest";
import { createChatDocuments, type ChatDocumentRef } from "@/lib/chat/createChatDocuments";

const { readUnits } = vi.hoisted(() => ({ readUnits: vi.fn() }));
vi.mock("@/lib/units/readUnits", () => ({ readUnits }));
const { createReadUnitsTool } = await import("@/lib/chat/createReadUnitsTool");

const call = { toolCallId: "c", messages: [] } as never;
const ref: ChatDocumentRef = {
  sourceKind: "vault",
  sourceId: "doc-a",
  revision: "r1",
  title: "Liner notes",
  url: "https://example.com/a",
};
const unit = (page: number, tokens: number) => ({
  locator: `p. ${page}`,
  text: `page ${page}`,
  tokens,
});

const setup = (remainingTokens = 1000) => {
  const documents = createChatDocuments(vi.fn(() => 1));
  documents.register(ref);
  const budget = { remainingTokens };
  const tool = createReadUnitsTool("artist-1", documents, budget);
  const run = (n: number, locators: string[]) => tool.execute!({ n, locators }, call);
  return { budget, run };
};

beforeEach(() => readUnits.mockReset());

describe("createReadUnitsTool", () => {
  test("returns the requested units of a registered document", async () => {
    readUnits.mockResolvedValue({ revision: "r1", units: [unit(1, 100), unit(3, 200)] });
    const { budget, run } = setup();
    expect(await run(1, ["p. 1", "p. 3"])).toEqual({
      n: 1,
      title: "Liner notes",
      units: [
        { locator: "p. 1", text: "page 1" },
        { locator: "p. 3", text: "page 3" },
      ],
      truncated: false,
    });
    expect(readUnits).toHaveBeenCalledWith("artist-1", { sourceKind: "vault", sourceId: "doc-a" }, [
      "p. 1",
      "p. 3",
    ]);
    expect(budget.remainingTokens).toBe(700);
  });

  test("refuses a document number it never handed out", async () => {
    const { run } = setup();
    expect(await run(4, ["p. 1"])).toEqual({ error: "Unknown document number" });
    expect(readUnits).not.toHaveBeenCalled();
  });

  test("readUnits returns an error when the document is no longer public", async () => {
    readUnits.mockResolvedValue(null);
    const { budget, run } = setup();
    expect(await run(1, ["p. 1"])).toEqual({ error: "Source changed or is no longer public" });
    expect(budget.remainingTokens).toBe(1000);
  });

  test("readUnits refuses a revision that moved on", async () => {
    readUnits.mockResolvedValue({ revision: "r2", units: [unit(1, 100)] });
    const { budget, run } = setup();
    expect(await run(1, ["p. 1"])).toEqual({ error: "Source changed or is no longer public" });
    expect(budget.remainingTokens).toBe(1000);
  });

  test("readUnits truncates at the token budget", async () => {
    readUnits.mockResolvedValue({
      revision: "r1",
      units: [unit(1, 400), unit(2, 500), unit(3, 300), unit(4, 50)],
    });
    const { budget, run } = setup(1000);
    expect(await run(1, ["p. 1", "p. 2", "p. 3", "p. 4"])).toEqual({
      n: 1,
      title: "Liner notes",
      units: [
        { locator: "p. 1", text: "page 1" },
        { locator: "p. 2", text: "page 2" },
      ],
      truncated: true,
    });
    expect(budget.remainingTokens).toBe(100);
    // The budget is shared across calls: the next read gets nothing it cannot fit whole.
    readUnits.mockResolvedValue({ revision: "r1", units: [unit(5, 101)] });
    expect(await run(1, ["p. 5"])).toEqual({
      n: 1,
      title: "Liner notes",
      units: [],
      truncated: true,
    });
    expect(budget.remainingTokens).toBe(100);
  });

  test("accepts 1 to 6 whole-number document references", () => {
    const { inputSchema } = createReadUnitsTool("artist-1", createChatDocuments(vi.fn()), {
      remainingTokens: 1,
    }) as unknown as { inputSchema: { safeParse(v: unknown): { success: boolean } } };
    const ok = (v: unknown) => inputSchema.safeParse(v).success;
    expect(ok({ n: 1, locators: ["p. 1"] })).toBe(true);
    expect(ok({ n: 1, locators: Array(6).fill("p. 1") })).toBe(true);
    expect(ok({ n: 1, locators: Array(7).fill("p. 1") })).toBe(false);
    expect(ok({ n: 1, locators: [] })).toBe(false);
    expect(ok({ n: 0, locators: ["p. 1"] })).toBe(false);
    expect(ok({ n: 1.5, locators: ["p. 1"] })).toBe(false);
  });
});
