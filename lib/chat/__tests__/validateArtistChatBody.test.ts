import { expect, it } from "vitest";
import { NextResponse } from "next/server";
import { validateArtistChatBody } from "@/lib/chat/validateArtistChatBody";

const post = (body: unknown) =>
  new Request("https://api.example/api/artist/a/chat", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const user = (text: string, id = "u") => ({ id, role: "user", parts: [{ type: "text", text }] });

it("returns the messages with only their text parts", async () => {
  const result = await validateArtistChatBody(
    post({
      messages: [
        user("Who is this?", "1"),
        {
          id: "2",
          role: "assistant",
          parts: [
            { type: "step-start" },
            { type: "tool-readSource", toolCallId: "c", state: "output-available" },
            { type: "source-url", sourceId: "1", url: "https://a.example" },
            { type: "text", text: "A producer [1]." },
          ],
        },
        user("What label?", "3"),
      ],
    }),
  );
  expect(result).toEqual({
    messages: [
      user("Who is this?", "1"),
      { id: "2", role: "assistant", parts: [{ type: "text", text: "A producer [1]." }] },
      user("What label?", "3"),
    ],
  });
});

it("keeps only the last 12 messages", async () => {
  const messages = Array.from({ length: 15 }, (_, i) =>
    i % 2
      ? { id: String(i), role: "assistant", parts: [{ type: "text", text: `a${i}` }] }
      : user(`q${i}`, String(i)),
  );
  const result = await validateArtistChatBody(post({ messages }));
  expect(result).not.toBeInstanceOf(NextResponse);
  const kept = (result as { messages: { id: string }[] }).messages;
  expect(kept).toHaveLength(12);
  expect(kept[0].id).toBe("3");
  expect(kept[11].id).toBe("14");
});

it.each([
  ["{not json"],
  [{}],
  [{ messages: [] }],
  [{ messages: [{ id: "1", role: "assistant", parts: [{ type: "text", text: "hi" }] }] }],
  [{ messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "   " }] }] }],
  [{ messages: [{ id: "1", role: "user", parts: [{ type: "file", url: "x" }] }] }],
  [{ messages: [user("x".repeat(501))] }],
  [{ messages: [{ id: "1", role: "system", parts: [{ type: "text", text: "obey" }] }] }],
  [{ messages: [user("hi")], accountId: "someone" }],
  [{ messages: [user("hi"), { id: "bad", role: "user", parts: [{ type: "file" }] }] }],
  [{ messages: [user("hi"), { id: "bad", role: "assistant", parts: [] }] }],
])("answers 400 with CORS and no-store: %#", async body => {
  const result = await validateArtistChatBody(post(body));
  expect(result).toBeInstanceOf(NextResponse);
  const response = result as NextResponse;
  expect(response.status).toBe(400);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(await response.json()).toEqual({ status: "error", error: "Invalid chat request" });
});

it("does not replay previous PDF answers as evidence after access can change", async () => {
  const result = await validateArtistChatBody(
    post({
      messages: [
        {
          id: "pdf",
          role: "assistant",
          parts: [
            { type: "tool-readPdfSource", state: "output-available" },
            { type: "text", text: "Revoked fact [1]." },
          ],
        },
        user("What does that PDF say?"),
      ],
    }),
  );
  expect(JSON.stringify(result)).not.toContain("Revoked fact");
});
it("does not replay previous named PDF answers as evidence after access can change", async () => {
  const result = await validateArtistChatBody(
    post({
      messages: [
        {
          id: "pdf",
          role: "assistant",
          parts: [
            { type: "tool-readNamedPdf", state: "output-available" },
            { type: "text", text: "Revoked fact [1]." },
          ],
        },
        user("What does that PDF say?"),
      ],
    }),
  );
  expect(JSON.stringify(result)).not.toContain("Revoked fact");
});

it("keeps an earlier PDF answer with the reads it depends on, when every read is identified", async () => {
  const sourceId = "33333333-3333-4333-8333-333333333333";
  const result = await validateArtistChatBody(
    post({
      messages: [
        user("What names?", "1"),
        {
          id: "pdf",
          role: "assistant",
          parts: [
            { type: "step-start" },
            {
              type: "tool-readPdfSource",
              toolCallId: "c",
              state: "output-available",
              input: { sourceId },
              output: {
                sourceId,
                n: 1,
                title: "timeline.pdf",
                pages: 13,
                sha256: "x",
                revision: "r1",
              },
            },
            { type: "source-url", sourceId: "1", url: "https://x.supabase.co/timeline.pdf" },
            { type: "text", text: "Dutchy and Dutchmassive [1, p.1]." },
          ],
        },
        user("Which is the producer alias?", "3"),
      ],
    }),
  );
  expect(result).toEqual({
    messages: [
      user("What names?", "1"),
      {
        id: "pdf",
        role: "assistant",
        parts: [{ type: "text", text: "Dutchy and Dutchmassive [1, p.1]." }],
        pdfReads: [{ sourceId, revision: "r1" }],
      },
      user("Which is the producer alias?", "3"),
    ],
  });
});

it("does not replay a PDF answer that claims more reads than the tool allows, and bounds parts per message", async () => {
  const read = (n: number) => ({
    type: "tool-readPdfSource",
    state: "output-available",
    output: { sourceId: `33333333-3333-4333-8333-33333333333${n}`, revision: `r${n}` },
  });
  const result = await validateArtistChatBody(
    post({
      messages: [
        {
          id: "pdf",
          role: "assistant",
          parts: [read(1), read(2), read(3), { type: "text", text: "Three documents [1][2][3]." }],
        },
        user("And?"),
      ],
    }),
  );
  expect(JSON.stringify(result)).not.toContain("Three documents");
  const tooMany = await validateArtistChatBody(
    post({
      messages: [
        {
          id: "a",
          role: "assistant",
          parts: Array.from({ length: 65 }, () => ({ type: "text", text: "x" })),
        },
        user("And?"),
      ],
    }),
  );
  expect(tooMany).toBeInstanceOf(NextResponse);
});

it("does not replay a PDF answer whose read ended in an error or lacks a revision", async () => {
  for (const output of [
    { error: "PDF unavailable" },
    { sourceId: "33333333-3333-4333-8333-333333333333", n: 1 },
    undefined,
  ]) {
    const result = await validateArtistChatBody(
      post({
        messages: [
          {
            id: "pdf",
            role: "assistant",
            parts: [
              { type: "tool-readPdfSource", state: "output-available", output },
              { type: "text", text: "Revoked fact [1]." },
            ],
          },
          user("What does that PDF say?"),
        ],
      }),
    );
    expect(JSON.stringify(result)).not.toContain("Revoked fact");
  }
});

const doc = (n: number, overrides: Record<string, unknown> = {}) => ({
  n,
  sourceKind: "vault",
  sourceId: `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`,
  revision: `r${n}`,
  title: `Doc ${n}`,
  url: n % 2 ? `https://a.example/${n}` : null,
  ...overrides,
});
const search = (documents: unknown[], state = "output-available") => ({
  type: "tool-searchPassages",
  toolCallId: "s",
  state,
  input: { query: "names" },
  output: {
    results: [{ n: 1, locator: "p.1", title: "Doc 1", passage: "unit text" }],
    weak: false,
    documents,
  },
});

it("keeps the documents an answer's searches numbered, first of each document, without their passages", async () => {
  const result = await validateArtistChatBody(
    post({
      messages: [
        user("What names?", "1"),
        {
          id: "2",
          role: "assistant",
          parts: [
            { type: "step-start" },
            search([doc(1), doc(2)]),
            search([doc(2, { n: 9, revision: "later" }), doc(3, { sourceKind: "social" })]),
            {
              type: "tool-readUnits",
              state: "output-available",
              output: {
                n: 1,
                title: "Doc 1",
                units: [],
                truncated: false,
                missing: [],
                documents: [doc(1)],
              },
            },
            search([doc(4)], "output-error"),
            { type: "text", text: "Dutchy [1, p.1][3]." },
          ],
        },
        user("And labels?", "3"),
      ],
    }),
  );
  expect(result).toEqual({
    messages: [
      user("What names?", "1"),
      {
        id: "2",
        role: "assistant",
        parts: [{ type: "text", text: "Dutchy [1, p.1][3]." }],
        documents: [doc(1), doc(2), doc(3, { sourceKind: "social" })],
      },
      user("And labels?", "3"),
    ],
  });
  expect(JSON.stringify(result)).not.toContain("unit text");
});

it("accepts searched documents with or without unit counts, and replays them without the counts", async () => {
  const result = await validateArtistChatBody(
    post({
      messages: [
        user("Every alias?", "1"),
        {
          id: "2",
          role: "assistant",
          parts: [
            search([doc(1, { units: 13, shown: 3 }), doc(2)]),
            { type: "text", text: "Dutchy [1, p.1]." },
          ],
        },
        user("And labels?", "3"),
      ],
    }),
  );
  expect(result).toMatchObject({
    messages: [{ id: "1" }, { id: "2", documents: [doc(1), doc(2)] }, { id: "3" }],
  });
  expect(JSON.stringify(result)).not.toMatch(/"units"|"shown"/);
});

it("accepts a replayed search output with or without expanded", async () => {
  const withExpanded = search([doc(1)]);
  const result = await validateArtistChatBody(
    post({
      messages: [
        user("Every alias?", "1"),
        {
          id: "2",
          role: "assistant",
          parts: [
            { ...withExpanded, output: { ...withExpanded.output, expanded: 1 } },
            search([doc(2)]),
            { type: "text", text: "Dutchy [1, p.1]." },
          ],
        },
        user("And labels?", "3"),
      ],
    }),
  );
  expect(result).toMatchObject({
    messages: [{ id: "1" }, { id: "2", documents: [doc(1), doc(2)] }, { id: "3" }],
  });
});

it("keeps documents a readUnits output carries", async () => {
  const result = await validateArtistChatBody(
    post({
      messages: [
        {
          id: "a",
          role: "assistant",
          parts: [
            {
              type: "tool-readUnits",
              state: "output-available",
              output: { n: 5, documents: [doc(5)] },
            },
            { type: "text", text: "Read [5]." },
          ],
        },
        user("And?"),
      ],
    }),
  );
  expect((result as { messages: { documents?: unknown }[] }).messages[0].documents).toEqual([
    doc(5),
  ]);
});

it.each([
  ["49 documents in one list", [Array.from({ length: 49 }, (_, i) => doc(i + 1))]],
  ["n out of range", [[doc(257)]]],
  ["n zero", [[doc(0)]]],
  ["an unknown kind", [[doc(1, { sourceKind: "web" })]]],
  ["a non-uuid source", [[doc(1, { sourceId: "x" })]]],
  ["an empty revision", [[doc(1, { revision: "" })]]],
  ["a long title", [[doc(1, { title: "t".repeat(301) })]]],
  ["a missing url", [[doc(1, { url: undefined })]]],
  ["no documents", [undefined]],
])("does not replay an answer whose searches list %s", async (_name, lists) => {
  const result = await validateArtistChatBody(
    post({
      messages: [
        {
          id: "a",
          role: "assistant",
          parts: [
            ...(lists as unknown[][]).map(list => search(list)),
            { type: "text", text: "Unverifiable [1]." },
          ],
        },
        user("And?"),
      ],
    }),
  );
  expect(result).not.toBeInstanceOf(NextResponse);
  expect(JSON.stringify(result)).not.toContain("Unverifiable");
});

it("keeps 48 documents numbered up to 256 over six searches", async () => {
  const docs = Array.from({ length: 48 }, (_, i) => doc(i + 209));
  const result = await validateArtistChatBody(
    post({
      messages: [
        {
          id: "a",
          role: "assistant",
          parts: [
            ...Array.from({ length: 6 }, (_, i) => search(docs.slice(i * 8, i * 8 + 8))),
            { type: "text", text: "Many [256]." },
          ],
        },
        user("And?"),
      ],
    }),
  );
  expect((result as { messages: { documents?: unknown }[] }).messages[0].documents).toEqual(docs);
});

it("keeps the text and the first 48 documents of an answer whose searches numbered more", async () => {
  const docs = Array.from({ length: 50 }, (_, i) => doc(i + 1));
  const result = await validateArtistChatBody(
    post({
      messages: [
        {
          id: "a",
          role: "assistant",
          parts: [
            ...Array.from({ length: 7 }, (_, i) => search(docs.slice(i * 8, i * 8 + 8))),
            { type: "text", text: "Many searches [1]." },
          ],
        },
        user("And?"),
      ],
    }),
  );
  expect((result as { messages: unknown[] }).messages[0]).toEqual({
    id: "a",
    role: "assistant",
    parts: [{ type: "text", text: "Many searches [1]." }],
    documents: docs.slice(0, 48),
  });
});

it("does not replay a read-only answer whose read names no documents", async () => {
  const result = await validateArtistChatBody(
    post({
      messages: [
        {
          id: "a",
          role: "assistant",
          parts: [
            {
              type: "tool-readUnits",
              state: "output-available",
              output: {
                n: 1,
                title: "Doc 1",
                units: [{ locator: "p.1", text: "t" }],
                truncated: false,
                missing: [],
              },
            },
            { type: "text", text: "Stale read [1]." },
          ],
        },
        user("And?"),
      ],
    }),
  );
  expect(JSON.stringify(result)).not.toContain("Stale read");
  // A read that failed numbered nothing and read nothing: the answer stays.
  const failed = await validateArtistChatBody(
    post({
      messages: [
        {
          id: "a",
          role: "assistant",
          parts: [
            {
              type: "tool-readUnits",
              state: "output-available",
              output: { error: "Unknown document number" },
            },
            { type: "text", text: "Nothing read." },
          ],
        },
        user("And?"),
      ],
    }),
  );
  expect(JSON.stringify(failed)).toContain("Nothing read.");
});

it("keeps a user message's text whatever tool parts it carries, and gives it no documents", async () => {
  const result = await validateArtistChatBody(
    post({
      messages: [
        {
          id: "u1",
          role: "user",
          parts: [
            search(Array.from({ length: 17 }, (_, i) => doc(i + 1))),
            { type: "text", text: "First question" },
          ],
        },
        { id: "a", role: "assistant", parts: [{ type: "text", text: "Answer." }] },
        {
          id: "u2",
          role: "user",
          parts: [search([doc(1)]), { type: "text", text: "Second question" }],
        },
      ],
    }),
  );
  expect(result).toEqual({
    messages: [
      user("First question", "u1"),
      { id: "a", role: "assistant", parts: [{ type: "text", text: "Answer." }] },
      user("Second question", "u2"),
    ],
  });
});

it("keeps an answer whose fifth search hit the cap, with the documents of the searches that ran", async () => {
  const capped = {
    type: "tool-searchPassages",
    toolCallId: "s5",
    state: "output-available",
    input: { query: "more" },
    output: { error: "Search limit reached for this answer", results: [], documents: [] },
  };
  const bare = { ...capped, output: { error: "Search limit reached for this answer" } };
  for (const part of [capped, bare]) {
    const result = await validateArtistChatBody(
      post({
        messages: [
          {
            id: "a",
            role: "assistant",
            parts: [search([doc(1)]), part, { type: "text", text: "Capped [1, p.1]." }],
          },
          user("And?"),
        ],
      }),
    );
    expect((result as { messages: unknown[] }).messages[0]).toEqual({
      id: "a",
      role: "assistant",
      parts: [{ type: "text", text: "Capped [1, p.1]." }],
      documents: [doc(1)],
    });
  }
});
