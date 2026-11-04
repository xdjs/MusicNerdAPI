import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { preparePdfEvalInput } from "../preparePdfEvalInput";
const bytes = Buffer.from("%PDF-offline");
const pin = {
  sourceId: "11111111-1111-4111-8111-111111111111",
  revision: "r1",
  filename: "test.pdf",
  bytes: bytes.length,
  pages: 1,
  sha256: createHash("sha256").update(bytes).digest("hex"),
};
const input = (data: unknown = bytes.toString("base64")) => ({
  prompt: [
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "t",
          toolName: "readPdfSource",
          output: {
            type: "content",
            value: [
              { type: "text", text: "original follows" },
              {
                type: "file",
                mediaType: "application/pdf",
                filename: "test.pdf",
                data: { type: "data", data },
              },
            ],
          },
        },
      ],
    },
  ],
});
it("keeps actual input unchanged and captures exact hash/reference instead of binary", () => {
  const original = input();
  const before = JSON.stringify(original);
  const result = preparePdfEvalInput(original as never, new Map([["t", pin]]));
  expect(JSON.stringify(original)).toBe(before);
  expect(JSON.stringify(result.prepared)).not.toContain(bytes.toString("base64"));
  expect(JSON.stringify(result.prepared)).toContain(pin.sha256);
  expect(result.pdfBytes).toBe(bytes.length);
  expect(result.pdfPages).toBe(1);
  expect(result.documents).toEqual([pin]);
});
it.each(["unknown call", "url", "wrong bytes", "wrong filename"])(
  "rejects %s before forwarding",
  kind => {
    const original = input();
    const file = original.prompt[0].content[0].output.value[1] as any;
    if (kind === "url") file.data = { type: "url", url: "https://example.com/private.pdf" };
    if (kind === "wrong bytes") file.data.data = Buffer.from("%PDF-wrong").toString("base64");
    if (kind === "wrong filename") file.filename = "other.pdf";
    expect(() =>
      preparePdfEvalInput(
        original as never,
        kind === "unknown call" ? new Map() : new Map([["t", pin]]),
      ),
    ).toThrow();
  },
);
