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
  const run = (n: number, locators?: string[]) => tool.execute!({ n, locators }, call);
  return { budget, run };
};

beforeEach(() => readUnits.mockReset());

describe("createReadUnitsTool", () => {
  test("returns the requested units of a registered document", async () => {
    readUnits.mockResolvedValue({
      revision: "r1",
      units: [unit(1, 100), unit(3, 200)],
      missing: [],
    });
    const { budget, run } = setup();
    expect(await run(1, ["p. 1", "p. 3"])).toEqual({
      n: 1,
      title: "Liner notes",
      units: [
        { locator: "p. 1", text: "page 1" },
        { locator: "p. 3", text: "page 3" },
      ],
      truncated: false,
      missing: [],
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
    readUnits.mockResolvedValue({ revision: "r2", units: [unit(1, 100)], missing: [] });
    const { budget, run } = setup();
    expect(await run(1, ["p. 1"])).toEqual({ error: "Source changed or is no longer public" });
    expect(budget.remainingTokens).toBe(1000);
  });

  test("readUnits truncates at the token budget", async () => {
    readUnits.mockResolvedValue({
      revision: "r1",
      units: [unit(1, 400), unit(2, 500), unit(3, 300), unit(4, 50)],
      missing: [],
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
      missing: [],
    });
    expect(budget.remainingTokens).toBe(100);
    // The budget is shared across calls: the next read gets nothing it cannot fit whole.
    readUnits.mockResolvedValue({ revision: "r1", units: [unit(5, 101)], missing: [] });
    expect(await run(1, ["p. 5"])).toEqual({
      n: 1,
      title: "Liner notes",
      units: [],
      truncated: true,
      missing: [],
    });
    expect(budget.remainingTokens).toBe(100);
  });

  test("reads the whole document when locators are omitted or empty", async () => {
    readUnits.mockResolvedValue({
      revision: "r1",
      units: [unit(1, 100), unit(2, 100), unit(3, 100)],
      missing: [],
    });
    const { budget, run } = setup(1000);
    const whole = {
      n: 1,
      title: "Liner notes",
      units: [1, 2, 3].map(page => ({ locator: `p. ${page}`, text: `page ${page}` })),
      truncated: false,
      missing: [],
    };
    expect(await run(1)).toEqual(whole);
    expect(await run(1, [])).toEqual(whole);
    expect(readUnits.mock.calls.map(c => c[2])).toEqual([[], []]);
    expect(budget.remainingTokens).toBe(400);
  });

  test("cuts a whole-document read at the budget, never mid-unit", async () => {
    readUnits.mockResolvedValue({
      revision: "r1",
      units: [unit(1, 300), unit(2, 300), unit(3, 300), unit(4, 300)],
      missing: [],
    });
    const { budget, run } = setup(900);
    expect(await run(1)).toEqual({
      n: 1,
      title: "Liner notes",
      units: [1, 2, 3].map(page => ({ locator: `p. ${page}`, text: `page ${page}` })),
      truncated: true,
      missing: [],
    });
    expect(budget.remainingTokens).toBe(0);
  });

  test("names the locators a current document lacks", async () => {
    readUnits.mockResolvedValue({ revision: "r1", units: [], missing: ["p. 9", "p. 10"] });
    const { budget, run } = setup();
    expect(await run(1, ["p. 9", "p. 10"])).toEqual({ error: "No such locator: p. 9, p. 10" });
    expect(budget.remainingTokens).toBe(1000);
  });

  test("returns what it found and lists the locators it did not", async () => {
    readUnits.mockResolvedValue({ revision: "r1", units: [unit(2, 100)], missing: ["p. 99"] });
    const { run } = setup();
    expect(await run(1, ["p. 2", "p. 99"])).toEqual({
      n: 1,
      title: "Liner notes",
      units: [{ locator: "p. 2", text: "page 2" }],
      truncated: false,
      missing: ["p. 99"],
    });
  });

  test("accepts up to 6 locators, or none, and whole-number document references", () => {
    const { inputSchema } = createReadUnitsTool("artist-1", createChatDocuments(vi.fn()), {
      remainingTokens: 1,
    }) as unknown as { inputSchema: { safeParse(v: unknown): { success: boolean } } };
    const ok = (v: unknown) => inputSchema.safeParse(v).success;
    expect(ok({ n: 1 })).toBe(true);
    expect(ok({ n: 1, locators: [] })).toBe(true);
    expect(ok({ n: 1, locators: ["p. 1"] })).toBe(true);
    expect(ok({ n: 1, locators: Array(6).fill("p. 1") })).toBe(true);
    expect(ok({ n: 1, locators: Array(7).fill("p. 1") })).toBe(false);
    expect(ok({ n: 0, locators: ["p. 1"] })).toBe(false);
    expect(ok({ n: 1.5, locators: ["p. 1"] })).toBe(false);
  });
});
