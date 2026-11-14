import { beforeEach, expect, it, vi } from "vitest";

const findCurrentDocuments = vi.fn();
vi.mock("@/lib/units/findCurrentDocuments", () => ({
  findCurrentDocuments: (...a: unknown[]) => findCurrentDocuments(...a),
}));
const loadChatPdfs = vi.fn();
vi.mock("@/lib/chatPdf/loadChatPdfs", () => ({
  loadChatPdfs: (...a: unknown[]) => loadChatPdfs(...a),
}));
const { keepCurrentCitedTurns } = await import("@/lib/chat/keepCurrentCitedTurns");

const uuid = (n: number) => `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`;
const doc = (
  n: number,
  sourceKind: "vault" | "social" | "evidence" = "vault",
  revision = `r${n}`,
  id = n,
) => ({ n, sourceKind, sourceId: uuid(id), revision, title: `Doc ${id}`, url: null });
const key = (d: { sourceKind: string; sourceId: string; revision: string }) =>
  `${d.sourceKind}:${d.sourceId}:${d.revision}`;
const ref = ({ n: _n, ...rest }: ReturnType<typeof doc>) => rest;
const lookup = ({ sourceKind, sourceId, revision }: ReturnType<typeof doc>) => ({
  sourceKind,
  sourceId,
  revision,
});
const text = (t: string) => [{ type: "text" as const, text: t }];

const messages = () => [
  { id: "1", role: "user" as const, parts: text("What names?") },
  // Cites a vault and a social document.
  {
    id: "2",
    role: "assistant" as const,
    parts: text("Dutchy [1][2]."),
    documents: [doc(2, "social"), doc(1)],
  },
  { id: "3", role: "user" as const, parts: text("And labels?") },
  // Cites the vault document again (same number) and an evidence document.
  {
    id: "4",
    role: "assistant" as const,
    parts: text("Night Label [1][3]."),
    documents: [doc(3, "evidence"), doc(1)],
  },
  { id: "5", role: "user" as const, parts: text("And the tour?") },
  { id: "6", role: "assistant" as const, parts: text("No documents cover that.") },
  { id: "7", role: "user" as const, parts: text("Which alias?") },
];

beforeEach(() => {
  findCurrentDocuments.mockReset();
  loadChatPdfs.mockReset();
});

it("keeps every turn whose documents are current, looks each distinct document up once, and returns prior in n order", async () => {
  findCurrentDocuments.mockImplementation(
    async (_a: string, refs: Parameters<typeof key>[0][]) => new Set(refs.map(key)),
  );
  const { messages: kept, prior } = await keepCurrentCitedTurns(messages(), "artist");
  expect(kept.map(m => m.id)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
  expect(kept.every(m => !("documents" in m))).toBe(true);
  expect(findCurrentDocuments).toHaveBeenCalledTimes(1);
  expect(findCurrentDocuments).toHaveBeenCalledWith("artist", [
    lookup(doc(2, "social")),
    lookup(doc(1)),
    lookup(doc(3, "evidence")),
  ]);
  expect(prior).toEqual([
    { n: 1, ref: ref(doc(1)) },
    { n: 2, ref: ref(doc(2, "social")) },
    { n: 3, ref: ref(doc(3, "evidence")) },
  ]);
  expect(loadChatPdfs).not.toHaveBeenCalled();
});

it("drops the turn whose document moved on and every later answer, keeps the earlier ones, and leaves its documents out of prior", async () => {
  // The evidence document changed revision since answer 4 read it.
  findCurrentDocuments.mockImplementation(
    async (_a: string, refs: Parameters<typeof key>[0][]) =>
      new Set(refs.filter(r => r.sourceKind !== "evidence").map(key)),
  );
  const { messages: kept, prior } = await keepCurrentCitedTurns(messages(), "artist");
  // Answer 6 carries no documents of its own, but it follows an answer that read the withdrawn one.
  expect(kept.map(m => m.id)).toEqual(["1", "2", "3", "5", "7"]);
  expect(JSON.stringify(kept)).not.toContain("Night Label");
  expect(prior).toEqual([
    { n: 1, ref: ref(doc(1)) },
    { n: 2, ref: ref(doc(2, "social")) },
  ]);
});

it("tells apart an older and a current revision of one document", async () => {
  const history = [
    { id: "1", role: "user" as const, parts: text("q") },
    {
      id: "2",
      role: "assistant" as const,
      parts: text("Old [1]."),
      documents: [doc(1, "vault", "old", 9)],
    },
    { id: "3", role: "user" as const, parts: text("q") },
    {
      id: "4",
      role: "assistant" as const,
      parts: text("New [4]."),
      documents: [doc(4, "vault", "new", 9)],
    },
    { id: "5", role: "user" as const, parts: text("q") },
  ];
  findCurrentDocuments.mockResolvedValue(new Set([key(doc(4, "vault", "new", 9))]));
  const { messages: kept, prior } = await keepCurrentCitedTurns(history, "artist");
  // The later answer follows one that read the older revision, so it goes too (running union).
  expect(kept.map(m => m.id)).toEqual(["1", "3", "5"]);
  expect(prior).toEqual([]);
  // Without the older answer, the current revision's answer stays.
  const { messages: alone, prior: alonePrior } = await keepCurrentCitedTurns(
    history.slice(2),
    "artist",
  );
  expect(alone.map(m => m.id)).toEqual(["3", "4", "5"]);
  expect(alonePrior).toEqual([{ n: 4, ref: ref(doc(4, "vault", "new", 9)) }]);
});

it("keeps the first number of a document cited under two", async () => {
  const history = [
    {
      id: "2",
      role: "assistant" as const,
      parts: text("[5]"),
      documents: [doc(5, "vault", "r", 1)],
    },
    {
      id: "4",
      role: "assistant" as const,
      parts: text("[2]"),
      documents: [doc(2, "vault", "r", 1)],
    },
    { id: "5", role: "user" as const, parts: text("q") },
  ];
  findCurrentDocuments.mockImplementation(
    async (_a: string, refs: Parameters<typeof key>[0][]) => new Set(refs.map(key)),
  );
  const { prior } = await keepCurrentCitedTurns(history, "artist");
  expect(prior).toEqual([{ n: 2, ref: ref(doc(2, "vault", "r", 1)) }]);
  expect(findCurrentDocuments.mock.calls[0][1]).toHaveLength(1);
});

it("leaves out of prior a number another document already holds", async () => {
  const history = [
    {
      id: "2",
      role: "assistant" as const,
      parts: text("[1]"),
      documents: [doc(1, "vault", "r", 1)],
    },
    {
      id: "4",
      role: "assistant" as const,
      parts: text("[1]"),
      documents: [doc(1, "social", "r", 2)],
    },
    { id: "5", role: "user" as const, parts: text("q") },
  ];
  findCurrentDocuments.mockImplementation(
    async (_a: string, refs: Parameters<typeof key>[0][]) => new Set(refs.map(key)),
  );
  const { prior } = await keepCurrentCitedTurns(history, "artist");
  expect(prior).toEqual([{ n: 1, ref: ref(doc(1, "vault", "r", 1)) }]);
});

it("maps kept turns back to their own documents when ids repeat", async () => {
  const history = [
    { id: "a", role: "assistant" as const, parts: text("Here [1]."), documents: [doc(1)] },
    { id: "a", role: "assistant" as const, parts: text("Gone [2]."), documents: [doc(2)] },
    { id: "u", role: "user" as const, parts: text("q") },
  ];
  findCurrentDocuments.mockResolvedValue(new Set([key(doc(1))]));
  const { messages: kept, prior } = await keepCurrentCitedTurns(history, "artist");
  expect(kept.map(m => m.parts[0].text)).toEqual(["Here [1].", "q"]);
  expect(prior).toEqual([{ n: 1, ref: ref(doc(1)) }]);
});

it("still applies the PDF rule: drops a turn whose PDF changed, whatever its documents", async () => {
  const pdf = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const history = [
    { id: "1", role: "user" as const, parts: text("q") },
    {
      id: "2",
      role: "assistant" as const,
      parts: text("PDF [1]."),
      pdfReads: [{ sourceId: pdf, revision: "a1" }],
    },
    { id: "3", role: "user" as const, parts: text("q") },
    { id: "4", role: "assistant" as const, parts: text("Units [1]."), documents: [doc(1)] },
    { id: "5", role: "user" as const, parts: text("q") },
  ];
  loadChatPdfs.mockResolvedValue([{ id: pdf, revision: "a2" }]);
  findCurrentDocuments.mockImplementation(
    async (_a: string, refs: Parameters<typeof key>[0][]) => new Set(refs.map(key)),
  );
  const { messages: kept, prior } = await keepCurrentCitedTurns(history, "artist");
  expect(kept).toEqual([
    { id: "1", role: "user", parts: text("q") },
    { id: "3", role: "user", parts: text("q") },
    { id: "4", role: "assistant", parts: text("Units [1].") },
    { id: "5", role: "user", parts: text("q") },
  ]);
  expect(prior).toEqual([{ n: 1, ref: ref(doc(1)) }]);
});

it("asks nothing of the database for a conversation without documents", async () => {
  const plain = messages().map(({ id, role, parts }) => ({ id, role, parts }));
  expect(await keepCurrentCitedTurns(plain, "artist")).toEqual({
    messages: plain,
    prior: [],
    highestCitedNumber: 3,
  });
  expect(findCurrentDocuments).not.toHaveBeenCalled();
});

it("drops a read-only turn when the document it read moved on", async () => {
  const history = [
    { id: "1", role: "user" as const, parts: text("q") },
    {
      id: "2",
      role: "assistant" as const,
      parts: text("Search [1]."),
      documents: [doc(1, "vault", "r1", 7)],
    },
    { id: "3", role: "user" as const, parts: text("q") },
    // Only read document 1 again: its documents come from the read.
    {
      id: "4",
      role: "assistant" as const,
      parts: text("Read [1]."),
      documents: [doc(1, "vault", "r1", 7)],
    },
    { id: "5", role: "user" as const, parts: text("q") },
  ];
  findCurrentDocuments.mockResolvedValue(new Set());
  const { messages: kept, prior } = await keepCurrentCitedTurns(history, "artist");
  expect(kept.map(m => m.id)).toEqual(["1", "3", "5"]);
  expect(prior).toEqual([]);
});

it("never drops a user message, whatever it carries", async () => {
  const history = [
    { id: "1", role: "user" as const, parts: text("q1"), documents: [doc(1)] },
    { id: "2", role: "assistant" as const, parts: text("a") },
    { id: "3", role: "user" as const, parts: text("q2") },
  ];
  findCurrentDocuments.mockResolvedValue(new Set());
  const { messages: kept, prior } = await keepCurrentCitedTurns(history, "artist");
  expect(kept.map(m => m.id)).toEqual(["1", "2", "3"]);
  expect(prior).toEqual([]);
  expect(findCurrentDocuments).not.toHaveBeenCalled();
});

it("drops a later answer that re-cites a withdrawn document from memory while searching another", async () => {
  const a = doc(1, "vault", "r1", 1);
  const b = doc(2, "vault", "r2", 2);
  const c = doc(3, "vault", "r3", 3);
  const history = [
    { id: "1", role: "user" as const, parts: text("q1") },
    {
      id: "2",
      role: "assistant" as const,
      parts: text("A [1, p.1]. B [2, p.1]."),
      documents: [a, b],
    },
    { id: "3", role: "user" as const, parts: text("q2") },
    // Cites A from memory; its own tools only numbered C.
    {
      id: "4",
      role: "assistant" as const,
      parts: text("A again [1, p.2]. C [3, p.1]."),
      documents: [c],
    },
    { id: "5", role: "user" as const, parts: text("q3") },
  ];
  // A was withdrawn.
  findCurrentDocuments.mockResolvedValue(new Set([key(b), key(c)]));
  const {
    messages: kept,
    prior,
    highestCitedNumber,
  } = await keepCurrentCitedTurns(history, "artist");
  expect(kept.map(m => m.id)).toEqual(["1", "3", "5"]);
  expect(JSON.stringify(kept)).not.toContain("A again");
  expect(prior).toEqual([]);
  expect(highestCitedNumber).toBe(0);
});

it("drops an answer with a document-form citation but no documents, and keeps a legacy-style [n] answer", async () => {
  const history = [
    { id: "1", role: "user" as const, parts: text("q1") },
    // Legacy-style: text only, plain [n] markers (a web or readSource citation).
    { id: "2", role: "assistant" as const, parts: text("Cedar [1][5].") },
    { id: "3", role: "user" as const, parts: text("q2") },
    // Claims page evidence but carries no documents to check it against.
    { id: "4", role: "assistant" as const, parts: text("Dutchy [7, p.4].") },
    { id: "5", role: "user" as const, parts: text("q3") },
  ];
  const {
    messages: kept,
    prior,
    highestCitedNumber,
  } = await keepCurrentCitedTurns(history, "artist");
  expect(kept.map(m => m.id)).toEqual(["1", "2", "3", "5"]);
  expect(prior).toEqual([]);
  // The kept legacy answer used 5, so a new number must start above it.
  expect(highestCitedNumber).toBe(5);
  expect(findCurrentDocuments).not.toHaveBeenCalled();
});

it("reports the highest number any kept answer cites, beyond its documents", async () => {
  const history = [
    {
      id: "2",
      role: "assistant" as const,
      parts: text("Doc [1, p.1]; web [6]; not a citation in 1999 [2026-05-13]."),
      documents: [doc(1)],
    },
    { id: "5", role: "user" as const, parts: text("q") },
  ];
  findCurrentDocuments.mockImplementation(
    async (_a: string, refs: Parameters<typeof key>[0][]) => new Set(refs.map(key)),
  );
  const { prior, highestCitedNumber } = await keepCurrentCitedTurns(history, "artist");
  expect(prior).toEqual([{ n: 1, ref: ref(doc(1)) }]);
  expect(highestCitedNumber).toBe(6);
});

it("finds the highest number in an answer with 200,000 markers without overflowing the stack", async () => {
  const history = [
    { id: "2", role: "assistant" as const, parts: text(`${"[1]".repeat(200_000)} [7]`) },
    { id: "5", role: "user" as const, parts: text("q") },
  ];
  const { highestCitedNumber } = await keepCurrentCitedTurns(history, "artist");
  expect(highestCitedNumber).toBe(7);
});
