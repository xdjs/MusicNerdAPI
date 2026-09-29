import { describe, it, expect, vi } from "vitest";
import { streamTurnEvents } from "@/lib/onboarding/streamTurnEvents";

async function read(stream: ReadableStream<Uint8Array>) {
  const text = await new Response(stream).text();
  return text
    .split("\n\n")
    .filter(Boolean)
    .map(l => JSON.parse(l.replace(/^data: /, "")));
}

describe("streamTurnEvents", () => {
  it("streams each event and closes", async () => {
    async function* turn() {
      yield { kind: "chat" as const, text: "a" };
      yield { kind: "complete" as const };
    }
    expect(await read(streamTurnEvents(turn(), Date.now()))).toEqual([
      { kind: "chat", text: "a" },
      { kind: "complete" },
    ]);
  });

  it("stops after the 55 s deadline with the resume message", async () => {
    const started = 1_000_000;
    const now = vi.spyOn(Date, "now").mockReturnValue(started + 55_001);
    async function* turn() {
      yield { kind: "chat" as const, text: "a" };
      yield { kind: "chat" as const, text: "never" };
    }
    expect(await read(streamTurnEvents(turn(), started))).toEqual([
      { kind: "chat", text: "a" },
      {
        kind: "error",
        message: "That took longer than expected — you can pick up right where you left off.",
      },
    ]);
    now.mockRestore();
  });

  it("turns a thrown turn into the generic error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    async function* turn() {
      yield { kind: "chat" as const, text: "a" };
      throw new Error("boom");
    }
    expect(await read(streamTurnEvents(turn(), Date.now()))).toEqual([
      { kind: "chat", text: "a" },
      { kind: "error", message: "Something went wrong on our end — try that again." },
    ]);
    error.mockRestore();
  });

  it("logs instead of throwing when the client disconnects mid-turn", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const gate: { open?: (v?: unknown) => void } = {};
    const paused = new Promise(r => {
      gate.open = r;
    });
    async function* turn() {
      yield { kind: "chat" as const, text: "first" };
      await paused;
      yield { kind: "chat" as const, text: "after-disconnect" };
      yield { kind: "complete" as const };
    }
    const reader = streamTurnEvents(turn(), Date.now()).getReader();
    await reader.read();
    await reader.cancel("client went away");
    gate.open?.();
    await new Promise(r => setTimeout(r, 20));
    expect(
      error.mock.calls.some(c => typeof c[0] === "string" && c[0].includes("after stream closed")),
    ).toBe(true);
    error.mockRestore();
  });
});
