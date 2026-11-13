import { expect, it, vi } from "vitest";
import { createChatCitations } from "@/lib/chat/createChatCitations";
import { createChatDocuments, type ChatDocumentRef } from "@/lib/chat/createChatDocuments";
import { seedCitationsFromPrior } from "@/lib/chat/seedCitationsFromPrior";

const uuid = (n: number) => `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`;
const ref = (
  id: number,
  url: string | null,
  sourceKind: ChatDocumentRef["sourceKind"] = "vault",
): ChatDocumentRef => ({
  sourceKind,
  sourceId: uuid(id),
  revision: `r${id}`,
  title: `Doc ${id}`,
  url,
});

it("seeds each prior document with its URL and title", () => {
  expect(
    seedCitationsFromPrior([
      { n: 1, ref: ref(1, "https://a.example/") },
      { n: 3, ref: ref(3, "https://b.example/") },
    ]),
  ).toEqual([
    { n: 1, url: "https://a.example/", title: "Doc 1" },
    { n: 3, url: "https://b.example/", title: "Doc 3" },
  ]);
});

it("seeds a document without a URL with its musicnerd:// URL", () => {
  expect(seedCitationsFromPrior([{ n: 2, ref: ref(2, null, "social") }])).toEqual([
    { n: 2, url: `musicnerd://social/${uuid(2)}`, title: "Doc 2" },
  ]);
});

it("gives a URL to the lowest n and seeds later sharers with their musicnerd:// URL", () => {
  expect(
    seedCitationsFromPrior([
      { n: 4, ref: ref(4, "https://shared.example/", "evidence") },
      { n: 2, ref: ref(2, "https://shared.example/") },
    ]),
  ).toEqual([
    { n: 2, url: "https://shared.example/", title: "Doc 2" },
    { n: 4, url: `musicnerd://evidence/${uuid(4)}`, title: "Doc 4" },
  ]);
});

it("lets createChatDocuments re-register every prior at its own number", () => {
  const prior = [
    { n: 5, ref: ref(5, "https://shared.example/") },
    { n: 1, ref: ref(1, null) },
    { n: 2, ref: ref(2, "https://shared.example/") },
    { n: 3, ref: ref(3, "https://c.example/") },
  ];
  const write = vi.fn();
  const cite = createChatCitations({ write } as never, seedCitationsFromPrior(prior));
  const documents = createChatDocuments(cite, prior);
  expect(documents.all().map(({ n, ref }) => [n, ref.sourceId])).toEqual([
    [1, uuid(1)],
    [2, uuid(2)],
    [3, uuid(3)],
    [5, uuid(5)],
  ]);
  // A new document continues after the highest prior number.
  expect(documents.register(ref(9, "https://new.example/"))).toBe(6);
  expect(write.mock.calls.map(([part]) => [part.sourceId, part.url])).toEqual([
    ["1", `musicnerd://vault/${uuid(1)}`],
    ["2", "https://shared.example/"],
    ["3", "https://c.example/"],
    ["5", `musicnerd://vault/${uuid(5)}`],
    ["6", "https://new.example/"],
  ]);
});
