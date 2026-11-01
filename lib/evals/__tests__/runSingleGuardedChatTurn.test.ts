import { runSingleGuardedChatTurn } from "@/lib/evals/runSingleGuardedChatTurn";
import { buildArtistChatInstructions } from "@/lib/chat/buildArtistChatInstructions";
import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
const m = vi.hoisted(() => ({
  artist: vi.fn(),
  sources: vi.fn(),
  visitor: vi.fn(),
  pdf: vi.fn(),
  turn: vi.fn(),
  guard: vi.fn(),
  gateway: vi.fn(),
}));
vi.mock("@/lib/questionResearch/loadResearchArtist", () => ({ loadResearchArtist: m.artist }));
vi.mock("@/lib/questionResearch/loadPublicResearchOriginals", () => ({
  loadPublicResearchOriginals: m.sources,
}));
vi.mock("@/lib/questionResearch/getQuestionVisitorKey", () => ({
  getQuestionVisitorKey: m.visitor,
}));
vi.mock("@/lib/chatPdf/loadChatPdfs", () => ({ loadChatPdfs: m.pdf }));
vi.mock("@/lib/evals/chatStreamTurn", () => ({ chatStreamTurn: m.turn }));
vi.mock("@/lib/evals/createGuardedChatExecution", () => ({ createGuardedChatExecution: m.guard }));
vi.mock("ai", async original => ({
  ...(await original<typeof import("ai")>()),
  gateway: m.gateway,
}));
const dirs: string[] = [];
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function setup(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), "single-case-"));
  dirs.push(dir);
  const manifest = {
    enabled: true,
    artistId: "11111111-1111-4111-8111-111111111111",
    artistName: "Artist",
    question: "Question",
    stagingOriginSha256: hash("https://fixture.supabase.co"),
    instructionsSha256: hash(JSON.stringify(buildArtistChatInstructions("Artist"))),
    toolSchemasSha256: "a".repeat(64),
    files: { "package.json": hash(readFileSync("package.json", "utf8")) },
    ...overrides,
  };
  const raw = JSON.stringify(manifest),
    path = join(dir, "manifest.json");
  writeFileSync(path, raw);
  for (const [k, v] of Object.entries({
    CHAT_SINGLE_MANIFEST_SHA256: hash(raw),
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_RUN_ID: "123",
    GITHUB_SHA: "a".repeat(40),
    CHAT_SINGLE_EXPECTED_SHA: "a".repeat(40),
    AI_GATEWAY_API_KEY: "fixture",
    TAVILY_API_KEY: "fixture",
    SUPABASE_DB_CONNECTION: "postgres://fixture:fixture@db.fixture.supabase.co/postgres",
    SUPABASE_URL: "https://fixture.supabase.co",
    MUSICNERD_RESEARCH_API_KEY: "fixture",
    BRAINTRUST_API_KEY: "fixture",
    RUNNER_TEMP: dir,
  }))
    vi.stubEnv(k, v);
  m.artist.mockResolvedValue({ name: "Artist" });
  m.sources.mockResolvedValue([{ sourceId: "one", revision: "r", text: "Public fixture" }]);
  m.visitor.mockResolvedValue("visitor");
  m.pdf.mockResolvedValue([]);
  m.guard.mockReturnValue(vi.fn());
  m.turn.mockResolvedValue({ answer: "fixture", sources: [], firstTextMs: 1, totalMs: 2 });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("network_forbidden");
    }),
  );
  return path;
}
it.each(["disabled", "rerun", "target", "instructions", "pdf"])(
  "rejects %s before handler admission or model construction",
  async failure => {
    const path = setup(
      failure === "disabled"
        ? { enabled: false }
        : failure === "instructions"
          ? { instructionsSha256: "f".repeat(64) }
          : {},
    );
    if (failure === "rerun") vi.stubEnv("GITHUB_RUN_ATTEMPT", "2");
    if (failure === "target") vi.stubEnv("SUPABASE_URL", "https://wrong.supabase.co");
    if (failure === "pdf") m.pdf.mockResolvedValue([{ id: "pdf" }]);
    await expect(runSingleGuardedChatTurn(path)).rejects.toThrow();
    expect(m.turn).not.toHaveBeenCalled();
    expect(m.gateway).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  },
);
it("claims once, uses real-boundary names without fixture overrides, and retains private evidence", async () => {
  const path = setup();
  const result = await runSingleGuardedChatTurn(path);
  expect(m.sources).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
  expect(m.turn).toHaveBeenCalledTimes(1);
  expect(result.diagnostic.records[0].kind).toBe("source-preflight");
  expect(m.turn.mock.calls[0][0]).toEqual({
    artistId: "11111111-1111-4111-8111-111111111111",
    question: "Question",
  });
  await expect(runSingleGuardedChatTurn(path)).rejects.toThrow();
  expect(m.turn).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
});

it("private record write failure stops before handler and model construction", async () => {
  const path = setup();
  const directory = join(process.env.RUNNER_TEMP!, "chat-single-123");
  mkdirSync(join(directory, "trace.jsonl"), { recursive: true });
  await expect(runSingleGuardedChatTurn(path)).rejects.toThrow();
  expect(m.turn).not.toHaveBeenCalled();
  expect(m.gateway).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("schema pin rejects changed prepared catalog through the guard record callback", async () => {
  const path = setup();
  m.guard.mockImplementation(
    config => async () =>
      config.record("model-input", { prepared: { tools: [{ name: "changed" }] } }),
  );
  m.turn.mockImplementation(async (_input, _clock, capture, execute) => {
    capture.claim();
    return execute({});
  });
  await expect(runSingleGuardedChatTurn(path)).rejects.toThrow("single_tool_schema_mismatch");
  expect(m.turn).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
});

it("malformed connection never includes credential input in its error", async () => {
  const path = setup();
  vi.stubEnv("SUPABASE_DB_CONNECTION", "PRIVATE_SENTINEL invalid");
  await expect(runSingleGuardedChatTurn(path)).rejects.toThrow("single_runtime_url_invalid");
  expect(m.artist).not.toHaveBeenCalled();
  expect(m.turn).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
