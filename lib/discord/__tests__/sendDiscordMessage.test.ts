import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendDiscordMessage } from "@/lib/discord/sendDiscordMessage";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("sendDiscordMessage", () => {
  it("does nothing without DISCORD_WEBHOOK_URL", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_URL", "");
    await sendDiscordMessage("hi");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the message as `content`", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.test/hook");
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await sendDiscordMessage("hi");
    expect(fetchMock).toHaveBeenCalledWith("https://discord.test/hook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "hi" }),
    });
  });

  it("logs and resolves when Discord fails", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.test/hook");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(sendDiscordMessage("hi")).resolves.toBeUndefined();
    fetchMock.mockRejectedValueOnce(new Error("down"));
    await expect(sendDiscordMessage("hi")).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
});
