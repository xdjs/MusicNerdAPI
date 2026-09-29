import { describe, it, expect, vi } from "vitest";
import { sendTurnEvent } from "@/lib/onboarding/sendTurnEvent";

describe("sendTurnEvent", () => {
  it("writes the event as one server-sent data line", () => {
    const enqueue = vi.fn();
    sendTurnEvent({ enqueue } as never, { kind: "chat", text: "hi" });
    expect(new TextDecoder().decode(enqueue.mock.calls[0][0])).toBe(
      'data: {"kind":"chat","text":"hi"}\n\n',
    );
  });

  it("never throws once the client has gone", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const enqueue = vi.fn(() => {
      throw new TypeError("Invalid state: Controller is already closed");
    });
    expect(() => sendTurnEvent({ enqueue } as never, { kind: "complete" })).not.toThrow();
    error.mockRestore();
  });
});
