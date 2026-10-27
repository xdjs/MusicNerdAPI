import { expect, it } from "vitest";
import { convertArrayToReadableStream, convertReadableStreamToArray } from "ai/test";
import { withoutCustomParts } from "@/lib/ai/withoutCustomParts";

it("drops provider custom parts and keeps every other part in order", async () => {
  const parts = [
    { type: "start" },
    { type: "custom", kind: "anthropic.message_start", providerMetadata: {} },
    { type: "text-delta", id: "t", text: "Hi" },
    { type: "finish" },
  ];
  const kept = await convertReadableStreamToArray(
    withoutCustomParts(convertArrayToReadableStream(parts) as never),
  );
  expect(kept).toEqual([parts[0], parts[2], parts[3]]);
});
