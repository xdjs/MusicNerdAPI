import { describe, it, expect, vi, beforeEach } from "vitest";

const postAskArtistHandler = vi.fn();
const postQuestionAnswerHandler = vi.fn();
const getQuestionProgressHandler = vi.fn();
vi.mock("@/lib/questionResearch/postAskArtistHandler", () => ({
  postAskArtistHandler: (...a: unknown[]) => postAskArtistHandler(...a),
}));
vi.mock("@/lib/questionResearch/postQuestionAnswerHandler", () => ({
  postQuestionAnswerHandler: (...a: unknown[]) => postQuestionAnswerHandler(...a),
}));
vi.mock("@/lib/questionResearch/getQuestionProgressHandler", () => ({
  getQuestionProgressHandler: (...a: unknown[]) => getQuestionProgressHandler(...a),
}));
const { askArtistTurn } = await import("@/lib/evals/askArtistTurn");

const ARTIST = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const JOB = "11111111-2222-4333-8444-555555555555";
const answer = {
  status: "ok",
  answer: "Richmond, Virginia [1].",
  sources: [{ n: 1, title: "vca.virginia.gov", url: "https://vca.virginia.gov/x", revision: "r" }],
};

/** A clock that moves 1 s per read, so timings are checkable. */
function clock() {
  let t = 0;
  return () => (t += 1000);
}

beforeEach(() => vi.resetAllMocks());

describe("askArtistTurn", () => {
  it("returns a 200 answer straight away, with the visitor IP header the allowance needs", async () => {
    postAskArtistHandler.mockResolvedValueOnce(Response.json(answer));
    const turn = await askArtistTurn(
      { artistId: ARTIST, question: "Where?" },
      { now: clock(), sleep: async () => {} },
    );
    expect(turn).toEqual({
      answer: "Richmond, Virginia [1].",
      sources: [{ n: 1, title: "vca.virginia.gov", url: "https://vca.virginia.gov/x" }],
      firstTextMs: 1000,
      totalMs: 1000,
    });
    const request: Request = postAskArtistHandler.mock.calls[0][0];
    expect(await request.json()).toEqual({ artistId: ARTIST, question: "Where?" });
    expect(request.headers.get("x-real-ip")).toBeTruthy();
  });

  it("follows a complete 202 with the answer call for the resolved question, as Web does", async () => {
    postAskArtistHandler.mockResolvedValueOnce(
      Response.json(
        {
          status: "ok",
          research: { jobId: JOB, stage: "complete", resolvedQuestion: "Where is it?" },
        },
        { status: 202 },
      ),
    );
    postQuestionAnswerHandler.mockResolvedValueOnce(Response.json(answer));
    const turn = await askArtistTurn(
      { artistId: ARTIST, question: "Where?" },
      { now: clock(), sleep: async () => {} },
    );
    expect(turn.answer).toBe("Richmond, Virginia [1].");
    const [request, id, jobId] = postQuestionAnswerHandler.mock.calls[0];
    expect([id, jobId]).toEqual([ARTIST, JOB]);
    expect(await request.json()).toEqual({ question: "Where is it?" });
    expect(getQuestionProgressHandler).not.toHaveBeenCalled();
  });

  it("polls a running job every 5 s and asks for the answer once it is terminal", async () => {
    const sleep = vi.fn(async () => {});
    postAskArtistHandler.mockResolvedValueOnce(
      Response.json(
        { status: "ok", research: { jobId: JOB, stage: "searching" } },
        { status: 202 },
      ),
    );
    getQuestionProgressHandler
      .mockResolvedValueOnce(Response.json({ status: "ok", jobId: JOB, stage: "reading" }))
      .mockResolvedValueOnce(Response.json({ status: "ok", jobId: JOB, stage: "complete" }));
    postQuestionAnswerHandler.mockResolvedValueOnce(Response.json(answer));
    const turn = await askArtistTurn(
      { artistId: ARTIST, question: "Where?" },
      { now: clock(), sleep },
    );
    expect(getQuestionProgressHandler).toHaveBeenCalledTimes(2);
    expect(getQuestionProgressHandler.mock.calls[0].slice(1)).toEqual([ARTIST, JOB]);
    expect(sleep).toHaveBeenCalledWith(5000);
    expect(await postQuestionAnswerHandler.mock.calls[0][0].json()).toEqual({ question: "Where?" });
    expect(turn.answer).toBe("Richmond, Virginia [1].");
    expect(turn.firstTextMs).toBe(turn.totalMs);
  });

  it("keeps polling when the answer call is still 202", async () => {
    postAskArtistHandler.mockResolvedValueOnce(
      Response.json(
        { status: "ok", research: { jobId: JOB, stage: "searching" } },
        { status: 202 },
      ),
    );
    getQuestionProgressHandler.mockImplementation(async () =>
      Response.json({ status: "ok", jobId: JOB, stage: "complete" }),
    );
    postQuestionAnswerHandler
      .mockResolvedValueOnce(
        Response.json(
          { status: "ok", research: { jobId: JOB, stage: "complete" } },
          { status: 202 },
        ),
      )
      .mockResolvedValueOnce(Response.json(answer));
    const turn = await askArtistTurn(
      { artistId: ARTIST, question: "Where?" },
      { now: clock(), sleep: async () => {} },
    );
    expect(postQuestionAnswerHandler).toHaveBeenCalledTimes(2);
    expect(turn.answer).toBe("Richmond, Virginia [1].");
  });

  it("returns an error response as an error turn, so its time still scores", async () => {
    postAskArtistHandler.mockResolvedValueOnce(
      Response.json({ status: "error", error: "Artist not found" }, { status: 404 }),
    );
    const turn = await askArtistTurn(
      { artistId: ARTIST, question: "Where?" },
      { now: clock(), sleep: async () => {} },
    );
    expect(turn).toEqual({
      answer: "",
      sources: [],
      firstTextMs: 1000,
      totalMs: 1000,
      error: "404 Artist not found",
    });
  });

  it("gives up after the client's five minutes", async () => {
    let t = 0;
    postAskArtistHandler.mockResolvedValueOnce(
      Response.json(
        { status: "ok", research: { jobId: JOB, stage: "searching" } },
        { status: 202 },
      ),
    );
    getQuestionProgressHandler.mockImplementation(async () =>
      Response.json({ status: "ok", jobId: JOB, stage: "searching" }),
    );
    const turn = await askArtistTurn(
      { artistId: ARTIST, question: "Where?" },
      { now: () => (t += 60_000), sleep: async () => {} },
    );
    expect(turn.error).toBe("timed out");
    expect(turn.answer).toBe("");
  });
});
