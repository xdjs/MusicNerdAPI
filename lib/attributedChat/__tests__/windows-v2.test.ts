import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { createAttributionRegistry } from "../createAttributionRegistry";
import { normalizeChatHistoryParts } from "../normalizeChatHistoryParts";
import { createReadSourceTool } from "@/lib/chat/createReadSourceTool";
import { originalFixture } from "@/lib/chat/__tests__/originalFixture";
import { transformAttributedStream } from "../transformAttributedStream";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

it("long reads issue bounded original-bound context blocks rather than a 12k dump", async () => {
  const text = ("Long unrelated paragraph. ".repeat(40) + "\n\n").repeat(12).slice(0, 12000);
  const original = originalFixture("vault:one", "https://source.example/a", text);
  const registry = createAttributionRegistry({
    artistId: "artist",
    turnId: "turn",
    assertCurrent: async () => {},
  });
  const result = registry.registerTextRead(original, {
    n: 1,
    title: "Source",
    url: original.url,
    text,
  });
  expect(result.blocks.length).toBeGreaterThan(1);
  for (const b of result.blocks) {
    const [p] = await registry.resolve([b.id], new AbortController().signal);
    expect(p.text.length).toBeLessThanOrEqual(2400);
    expect(p.text).toBe(text.slice(p.start, p.end));
    expect(p.readSha256).toBe(hash(text));
    expect(p.readId).toBe(result.readId);
    expect(p.contextIncomplete).toBe(true);
  }
});
it("nearby qualifying wording remains in the selected bounded bundle", async () => {
  const text =
    "X".repeat(1100) +
    "\nA record used the alias Paper Lark in 2009.\nThis credit does not establish when the alias began or ended.\n" +
    "Y".repeat(4000);
  const registry = createAttributionRegistry({
    artistId: "a",
    turnId: "t",
    assertCurrent: async () => {},
  });
  const result = registry.registerTextRead(originalFixture("s", "https://source.example/a", text), {
    n: 1,
    title: "s",
    url: "https://source.example/a",
    text,
  });
  const candidates = await Promise.all(
    result.blocks.map(async b => (await registry.resolve([b.id], new AbortController().signal))[0]),
  );
  const p = candidates.find(p => p.text.includes("Paper Lark"))!;
  expect(p.text).toContain("does not establish");
  expect(p.text.length).toBeLessThanOrEqual(2400);
});
it("retains a bounded tail locator with hash but no previous text or URL", async () => {
  const text = "prefix ".repeat(3000) + "TAIL ORIGINAL WITH QUALIFICATION";
  const start = 21000,
    end = text.length;
  const locator = {
    sourceId: "vault:one",
    revision: "r1",
    start,
    end,
    sha256: hash(text.slice(start, end)),
  };
  const parts = normalizeChatHistoryParts(
    [
      {
        type: "data-attributed-passage",
        data: {
          version: 1,
          ...locator,
          text: text.slice(start, end),
          url: "https://must-not-retain.example",
        },
      },
    ],
    "assistant",
  );
  expect(parts[0].text).toContain(JSON.stringify(locator));
  expect(parts[0].text).not.toContain("TAIL ORIGINAL");
  expect(parts[0].text).not.toContain("must-not-retain");
  const original = {
    ...originalFixture(locator.sourceId, "https://source.example/a", text),
    revision: "r1",
  };
  const read = createReadSourceTool(
    [original],
    () => 1,
    async () => {},
  );
  const output = (await read.execute!(
    { sourceId: original.sourceId, locator },
    {} as never,
  )) as any;
  expect(output.text).toBe(text.slice(start, end));
  expect(output.start).toBe(start);
  expect(output.end).toBe(end);
});
it.each(["stale", "hash", "bounds", "revoked"])("rejects invalid tail locator: %s", async mode => {
  const text = "prefix ".repeat(3000) + "tail";
  const original = {
    ...originalFixture("vault:one", "https://source.example/a", text),
    revision: "r1",
  };
  const locator = {
    sourceId: original.sourceId,
    revision: mode === "stale" ? "r0" : "r1",
    start: 21000,
    end: mode === "bounds" ? text.length + 1 : text.length,
    sha256: mode === "hash" ? "a".repeat(64) : hash("tail"),
  };
  const read = createReadSourceTool(
    [original],
    () => 1,
    async () => {
      if (mode === "revoked") throw new Error("withdrawn");
    },
  );
  if (mode === "revoked")
    await expect(
      read.execute!({ sourceId: original.sourceId, locator }, {} as never),
    ).rejects.toThrow();
  else
    expect(
      await read.execute!({ sourceId: original.sourceId, locator }, {} as never),
    ).toHaveProperty("error");
});
it("drops malformed navigational windows rather than downgrading them to source-only hints", () => {
  const parts = normalizeChatHistoryParts(
    [
      {
        type: "data-attributed-passage",
        data: {
          version: 1,
          sourceId: "vault:one",
          revision: "r1",
          start: -1,
          end: 25000,
          sha256: "not-a-hash",
        },
      },
    ],
    "assistant",
  );
  expect(parts).toEqual([]);
});

it.each(["count", "characters", "serialized bytes"])(
  "fails closed before exceeding displayed %s budget",
  async mode => {
    const registry = createAttributionRegistry({
      artistId: "a",
      turnId: "t",
      assertCurrent: async () => {},
    });
    const ids = Array.from({ length: mode === "count" ? 25 : 3 }, (_, i) => {
      const text = String(i).repeat(mode === "characters" ? 2400 : 100);
      const original = originalFixture(
        "s" + i,
        "https://source.example/" + i + (mode === "serialized bytes" ? "a".repeat(40000) : ""),
        text,
      );
      // Count guard uses distinct physical pages from one verified PDF, within
      // the separate 2-PDF read guard. No saved-source read cap is bypassed.
      const bound =
        mode === "count"
          ? {
              ...original,
              sourceId: "pdf:one",
              kind: "pdf-page-text" as const,
              originalSha256: "a".repeat(64),
              physicalPage: i + 1,
              physicalPages: 25,
              pageSha256: hash(text),
            }
          : original;
      return registry.registerTextRead(bound, {
        n: i + 1,
        title: "Source",
        url: original.url,
        text,
      }).blocks[0].id;
    });
    const raw = new ReadableStream<any>({
      start(c) {
        for (const id of ids)
          c.enqueue({
            type: "text-delta",
            id: "t",
            delta: JSON.stringify({ blocks: [id] }) + "\n",
          });
        c.enqueue({ type: "text-delta", id: "t", delta: '{"end":true}\n' });
        c.enqueue({ type: "finish", finishReason: "stop" });
        c.close();
      },
    });
    const reader = transformAttributedStream(raw, {
      registry,
      signal: new AbortController().signal,
    }).getReader();
    const parts: any[] = [];
    while (true) {
      const p = await reader.read();
      if (p.done) break;
      parts.push(p.value);
    }
    const shown = parts.filter(p => p.type === "data-attributed-passage");
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThanOrEqual(24);
    expect(
      shown.reduce((n, p) => n + Buffer.byteLength(JSON.stringify(p.data), "utf8"), 0),
    ).toBeLessThanOrEqual(65536);
    expect(shown.reduce((n, p) => n + p.data.text.length, 0)).toBeLessThanOrEqual(6000);
    expect(parts.filter(p => p.type === "data-attributed-status").at(-1).data.state).toBe(
      "partial",
    );
  },
);
it("keeps bounded block offsets on Unicode boundaries", async () => {
  const text = "😀".repeat(5000);
  const original = originalFixture("s", "https://source.example/a", text);
  const registry = createAttributionRegistry({
    artistId: "a",
    turnId: "t",
    assertCurrent: async () => {},
  });
  for (const b of registry.registerTextRead(original, {
    n: 1,
    title: "Source",
    url: original.url,
    text,
  }).blocks) {
    const [p] = await registry.resolve([b.id], new AbortController().signal);
    expect(p.text.isWellFormed()).toBe(true);
    expect(p.text).toBe(text.slice(p.start, p.end));
  }
});

it("offers full-page heading and late qualification context without declaring narrower PDF windows complete", async () => {
  // Synthetic diagnostic: geometry cannot know which heading governs a credit.
  const text =
    "Archive section 2007\n" +
    "A line of unrelated contextual detail.\n".repeat(45) +
    "Paper Lark and Glass Finch both receive credits on this release.\n" +
    "More contextual detail.\n".repeat(45) +
    "These credits document use here, not continuous use or the start and end of either name.\n";
  const registry = createAttributionRegistry({
    artistId: "synthetic-artist",
    turnId: "synthetic-turn",
    assertCurrent: async () => {},
  });
  const original = {
    ...originalFixture("pdf:synthetic", "https://source.example/archive.pdf", text),
    kind: "pdf-page-text" as const,
    originalSha256: "a".repeat(64),
    physicalPage: 1,
    physicalPages: 1,
    pageSha256: hash(text),
  };
  const result = registry.registerTextRead(original, {
    n: 1,
    title: "Synthetic archive",
    url: original.url,
    text,
  });
  const candidates = await Promise.all(
    result.blocks.map(async b => (await registry.resolve([b.id], new AbortController().signal))[0]),
  );
  const full = candidates.find(p => p.start === 0 && p.end === text.length)!;
  expect(full.text).toBe(text);
  expect(full.text).toContain("not continuous use");
  const narrow = candidates.find(
    p => p.text.includes("both receive credits") && !p.text.includes("Archive section 2007"),
  )!;
  expect(narrow).toBeDefined();
  expect(narrow.text).toBe(text.slice(narrow.start, narrow.end));
  expect(candidates.every(p => p.contextIncomplete)).toBe(true);
});
