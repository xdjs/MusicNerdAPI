import { expect, it } from "vitest";
import { getChatRetrievalMode } from "@/lib/chat/getChatRetrievalMode";

it("selects units only when CHAT_RETRIEVAL is units", () => {
  expect(getChatRetrievalMode({ CHAT_RETRIEVAL: "units" })).toBe("units");
});

it("stays on legacy when CHAT_RETRIEVAL is legacy, unset or anything else", () => {
  expect(getChatRetrievalMode({ CHAT_RETRIEVAL: "legacy" })).toBe("legacy");
  expect(getChatRetrievalMode({})).toBe("legacy");
  expect(getChatRetrievalMode({ CHAT_RETRIEVAL: "" })).toBe("legacy");
  expect(getChatRetrievalMode({ CHAT_RETRIEVAL: "Units" })).toBe("legacy");
});
