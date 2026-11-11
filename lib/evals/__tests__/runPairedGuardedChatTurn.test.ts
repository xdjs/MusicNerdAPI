import { createHash } from "node:crypto";
import { expect, it, vi, afterEach, beforeEach } from "vitest";
import { runPairedGuardedChatTurn } from "../runPairedGuardedChatTurn";
const mocks = vi.hoisted(() => ({ run: vi.fn(), question: vi.fn(), close: vi.fn() }));
vi.mock("../runSingleGuardedChatTurn", () => ({ runSingleGuardedChatTurn: mocks.run }));
vi.mock("node:readline/promises", () => ({
  createInterface: () => ({ question: mocks.question, close: mocks.close }),
}));
const inputDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
const outputDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
beforeEach(() => {
  Object.defineProperty(process.stdin, "isTTY", { configurable: true, get: () => true });
  Object.defineProperty(process.stdout, "isTTY", { configurable: true, get: () => true });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  if (inputDescriptor) Object.defineProperty(process.stdin, "isTTY", inputDescriptor);
  else delete (process.stdin as { isTTY?: boolean }).isTTY;
  if (outputDescriptor) Object.defineProperty(process.stdout, "isTTY", outputDescriptor);
  else delete (process.stdout as { isTTY?: boolean }).isTTY;
});
it("refuses noninteractive execution before any preflight or dispatch", async () => {
  vi.spyOn(process.stdin, "isTTY", "get").mockReturnValue(false);
  await expect(runPairedGuardedChatTurn("disabled.json")).rejects.toThrow(
    "pair_private_terminal_required",
  );
  expect(mocks.run).not.toHaveBeenCalled();
});
const acceptance = `PASS FIRST ANSWER ${createHash("sha256")
  .update(JSON.stringify({ firstTurn: { answer: "actual" }, clientMessage: {} }))
  .digest("hex")}`;
it.each([
  acceptance,
  "PASS FIRST ANSWER",
  `PASS FIRST ANSWER ${"0".repeat(64)}`,
  "pass",
  "",
  "FAIL",
])("requires exact human acceptance: %s", async answer => {
  vi.spyOn(process.stdin, "isTTY", "get").mockReturnValue(true);
  vi.spyOn(process.stdout, "isTTY", "get").mockReturnValue(true);
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  mocks.question.mockResolvedValue(answer);
  mocks.run.mockImplementation(async (_path, options) =>
    options.conversation.reviewFirst({ answer: "actual" }, {}, new AbortController().signal),
  );
  expect(await runPairedGuardedChatTurn("manifest.json")).toBe(
    answer === acceptance ? "pass" : "unscored",
  );
  expect(mocks.close).toHaveBeenCalledOnce();
});

it("closes the terminal when human review is cancelled", async () => {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  mocks.question.mockRejectedValue(new Error("aborted"));
  mocks.run.mockImplementation(async (_path, options) =>
    options.conversation.reviewFirst({ answer: "actual" }, {}, AbortSignal.abort()),
  );
  await expect(runPairedGuardedChatTurn("manifest.json")).rejects.toThrow("aborted");
  expect(mocks.close).toHaveBeenCalledOnce();
});
