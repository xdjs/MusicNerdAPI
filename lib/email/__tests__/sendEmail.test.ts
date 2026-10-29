import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail } from "@/lib/email/sendEmail";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const input = { to: "a@example.test", subject: "Hi", html: "<p>Hi</p>" };

describe("sendEmail", () => {
  it("skips without RESEND_API_KEY", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await sendEmail(input)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the message and reports success", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    expect(await sendEmail(input)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body)).toEqual({
      from: "Music Nerd <no-reply@musicnerd.xyz>",
      to: ["a@example.test"],
      subject: "Hi",
      html: "<p>Hi</p>",
    });
  });

  it("is false, never a throw, on a refusal or network error", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    fetchMock.mockResolvedValueOnce(new Response("no", { status: 422 }));
    expect(await sendEmail(input)).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await sendEmail(input)).toBe(false);
  });
});
