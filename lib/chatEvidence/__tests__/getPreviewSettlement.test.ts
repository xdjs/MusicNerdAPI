import { expect, it } from "vitest";
import { getPreviewSettlement } from "../getPreviewSettlement";
const step = { generationId: "gen_test", input: 3203, output: 342, finishReason: "tool-calls" };
const receipt = () => ({
  id: "gen_test",
  model: "anthropic/claude-sonnet-5.5",
  provider_name: "anthropic",
  streamed: true,
  finish_reason: "tool-calls",
  native_tokens_prompt: 3203,
  native_tokens_completion: 221,
  native_tokens_reasoning: 121,
  native_tokens_cached: 0,
  native_tokens_cache_creation: 0,
  billable_web_search_calls: 0,
  total_cost: 0.009826,
  surcharge_cost: 0,
  gateway_cost: 0.009826,
});
it("reconciles historical step-two accounting without counting reasoning twice", () => {
  expect(getPreviewSettlement(receipt(), step)).toBe(17855200);
});
it("retains all reported external charges", () => {
  expect(
    getPreviewSettlement({ ...receipt(), surcharge_cost: 0.002, gateway_cost: 0.011826 }, step),
  ).toBe(19855200);
});
it.each([
  { id: "wrong" },
  { model: "other" },
  { provider_name: "other" },
  { finish_reason: "length" },
  { native_tokens_reasoning: undefined },
  { native_tokens_prompt: 3204 },
  { native_tokens_completion: 342 },
  { gateway_cost: undefined },
  { gateway_cost: NaN },
  { surcharge_cost: -1 },
  { billable_web_search_calls: 1 },
  { native_tokens_cached: 9999 },
  { gateway_cost: 0.1 },
])("retains mismatched or incomplete receipt %j", change => {
  expect(getPreviewSettlement({ ...receipt(), ...change }, step)).toBeNull();
});
