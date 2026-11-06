import { expect, it } from "vitest";
import { getAttributedTextLimit } from "../getAttributedTextLimit";
const optIn = "text/event-stream; musicnerd-attributed-text=12000";
it.each([
  undefined,
  "*/*",
  "text/event-stream",
  "text/event-stream; musicnerd-attributed-text=6000",
  "text/event-stream; musicnerd-attributed-text=12001",
  "text/event-stream; musicnerd-attributed-text=-1",
  "text/event-stream; musicnerd-attributed-text=NaN",
  optIn + ", text/html",
  optIn + ", " + optIn,
  optIn + "; q=0",
  "text/event-stream; musicnerd-attributed-text=012000",
])("defaults to legacy6000 for non-opt-in %s", accept => {
  expect(
    getAttributedTextLimit(
      new Request("https://api.example/chat", {
        headers: accept === undefined ? {} : { Accept: accept },
      }),
    ),
  ).toBe(6000);
});
it("recognizes only the bounded opt-in and request-local isolation", () => {
  expect(
    getAttributedTextLimit(
      new Request("https://api.example/chat", { headers: { Accept: " " + optIn + " " } }),
    ),
  ).toBe(12000);
  expect(getAttributedTextLimit(new Request("https://api.example/chat"))).toBe(6000);
});
