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
