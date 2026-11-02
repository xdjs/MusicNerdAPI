import { afterEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ register: vi.fn(), run: vi.fn() }));
vi.mock("braintrust", () => ({ Eval: fixture.register }));
vi.mock("@/lib/evals/runSingleGuardedChatTurn", () => ({ runSingleGuardedChatTurn: fixture.run }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it.each(["aborted", "empty", "complete"])(
  "registers one unscored case and handles %s terminal explicitly",
  async mode => {
    vi.resetModules();
    vi.stubEnv("CHAT_SINGLE_MANIFEST", "disabled-local-manifest");
    const network = vi.fn(() => {
      throw new Error("network_forbidden");
    });
    vi.stubGlobal("fetch", network);
    await import("@/evals/chat.eval");
    expect(fixture.register).toHaveBeenCalledTimes(1);
    const config = fixture.register.mock.calls[0][1];
    expect(config.data()).toHaveLength(1);
    expect(config.scores).toEqual([]);
    expect(config.isPublic).toBe(false);
    const output = {
      answer: mode === "complete" ? "Supported answer." : "",
      ...(mode === "aborted" ? { error: "Aborted UI stream." } : {}),
      diagnostic: {
        records: [
          {
            kind: "terminal",
            value: { outcome: mode === "complete" ? "completed_transport" : "failed" },
          },
        ],
      },
    };
    fixture.run.mockResolvedValue(output);
    const log = vi.fn();
    const flush = vi.fn(async () => undefined);
    const task = config.task("disabled-local-manifest", { span: { log, flush } });
    if (mode === "complete") {
      await expect(task).resolves.toEqual(output);
      expect(log).not.toHaveBeenCalled();
      expect(flush).not.toHaveBeenCalled();
    } else {
      await expect(task).rejects.toThrow("single_chat_terminal_failed");
      expect(log).toHaveBeenCalledWith({ output });
      expect(flush).toHaveBeenCalledTimes(1);
      expect(log.mock.invocationCallOrder[0]).toBeLessThan(flush.mock.invocationCallOrder[0]);
    }
    expect(network).not.toHaveBeenCalled();
  },
);
