import { NoObjectGeneratedError } from "ai";
import { isDeepStrictEqual } from "node:util";
import { webSearch } from "@/lib/search/webSearch";
import { fetchSourceText } from "@/lib/sourceExtraction/fetchSourceText";
import { checkInstagramScrape } from "@/lib/instagram/checkInstagramScrape";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";
import { parseQuestionResearchState } from "@/lib/questionResearch/parseQuestionResearchState";
import { loadResearchArtist } from "@/lib/questionResearch/loadResearchArtist";
import { loadPublicResearchOriginals } from "@/lib/questionResearch/loadPublicResearchOriginals";
import { selectResearchReferences } from "@/lib/questionResearch/selectResearchReferences";
import { assessResearchEvidence } from "@/lib/questionResearch/assessResearchEvidence";
import { checkpointQuestionResearch } from "@/lib/questionResearch/checkpointQuestionResearch";
import { planQuestionResearch } from "@/lib/questionResearch/planQuestionResearch";
import { startQuestionSocialRun } from "@/lib/questionResearch/startQuestionSocialRun";
import { collectQuestionSocialOriginals } from "@/lib/questionResearch/collectQuestionSocialOriginals";
import { persistResearchOriginals } from "@/lib/questionResearch/persistResearchOriginals";
import { classifyQuestionOriginal } from "@/lib/questionResearch/classifyQuestionOriginal";
import { canonicalResearchUrl } from "@/lib/questionResearch/canonicalResearchUrl";
import { researchStatusMessage } from "@/lib/questionResearch/researchStatusMessage";
import { getResearchFailureDiagnostic } from "@/lib/questionResearch/getResearchFailureDiagnostic";
import {
  QUESTION_RESEARCH_LIFETIME_MS,
  type DiscoveryOriginal,
  type ResearchOriginal,
} from "@/lib/questionResearch/types";

/** Advance one durable research stage; publish transitions before slow work and never repeat paid starts. */
export async function runQuestionResearch(
  job: ResearchJob,
  deadline: number,
): Promise<SliceOutcome> {
  const state = parseQuestionResearchState(job.state);
  const stale = {
    done: false,
    waiting: true,
    progress: "Slice no longer owns this question research",
  };
  const finish = async () => {
    if (!(await checkpointQuestionResearch(job, state))) return stale;
    const done = ["complete", "unresolved", "failed", "cancelled"].includes(state.stage);
    return {
      done,
      ...(!done ? { waiting: true } : {}),
      progress: researchStatusMessage(state.stage, state.plan?.provider ?? null),
    };
  };
  const reserve = async (kind: "model" | "web" | "social_start" | "read") => {
    if (kind === "model") {
      if (state.modelCalls >= (state.savedOnly ? 1 : 2) + (state.outputRetries ?? 0))
        throw new Error("Model budget exceeded");
      state.modelCalls++;
    } else {
      if (state.providerCalls >= 16) throw new Error("Provider budget exceeded");
      state.providerCalls++;
    }
    if (kind !== "read") state.inFlight = kind;
    return checkpointQuestionResearch(job, state, false);
  };
  const asOriginal = (o: DiscoveryOriginal, i: number): ResearchOriginal => ({
    sourceId: `new:${i}`,
    revision: "pending",
    text: o.text,
    url: o.url,
    curation: "pending",
    evidenceKind: o.provenance.kind,
    speaker: o.provenance.speaker,
    publishedAt: o.provenance.publishedAt,
    retrievedAt: o.provenance.retrievedAt,
    truncated: o.provenance.truncated,
  });
  try {
    if (Date.now() - Date.parse(state.createdAt) > QUESTION_RESEARCH_LIFETIME_MS) {
      state.stage = "failed";
      state.errorCode = "research_expired";
      return await finish();
    }
    if (state.inFlight) {
      state.stage = "failed";
      state.errorCode = "external_outcome_unknown";
      return await finish();
    }
    if (deadline - Date.now() < 25000) return await finish();
    const artist = await loadResearchArtist(job.artistId);
    const plan = planQuestionResearch(state.request, artist);
    if (state.plan && !isDeepStrictEqual(plan, state.plan)) {
      state.stage = "cancelled";
      state.errorCode = "source_identity_changed";
      state.references = [];
      return await finish();
    }
    switch (state.step ?? "saved") {
      case "saved": {
        const originals = await loadPublicResearchOriginals(job.artistId);
        const references = selectResearchReferences(originals, state.request, artist.name ?? "");
        state.references = references;
        if (references.length) {
          if (!(await reserve("model"))) return stale;
          const assessment = await assessResearchEvidence(
            state.request,
            references,
            artist,
            [],
            deadline - Date.now() - 1000,
          );
          delete state.inFlight;
          state.inputTokens += assessment.inputTokens;
          state.outputTokens += assessment.outputTokens;
          if (assessment.sufficient) {
            state.references = assessment.references;
            state.stage = "complete";
            return await finish();
          }
        }
        if (state.savedOnly) {
          state.stage = "unresolved";
          state.references = [];
          state.limitations.push(
            "Outside research is at its limit. The saved sources checked did not establish this answer; no external search or scrape was started.",
          );
          return await finish();
        }
        state.plan = plan;
        state.stage = plan.stage;
        if (plan.provider === null) {
          state.limitations.push(plan.reason);
          return await finish();
        }
        state.step =
          plan.provider === "web" ? "search" : plan.provider === "page" ? "pages" : "social_start";
        if (plan.provider === "page") {
          state.candidates = [{ url: plan.targetUrl, title: "" }];
          state.nextCandidate = 0;
        }
        // Return after publishing the transition; provider execution is a later slice.
        return await finish();
      }
      case "search": {
        if (plan.provider !== "web") throw new Error("Research route changed");
        if (!(await reserve("web"))) return stale;
        const hits = await webSearch(plan.query, { maxResults: 5, throwOnError: true });
        delete state.inFlight;
        const seen = new Set<string>();
        state.candidates = hits
          .flatMap(h => {
            try {
              const url = canonicalResearchUrl(h.url);
              if (seen.has(url)) return [];
              seen.add(url);
              return [{ url, title: h.title.slice(0, 500) }];
            } catch {
              return [];
            }
          })
          .slice(0, 3);
        state.nextCandidate = 0;
        state.step = "pages";
        state.stage = "reading";
        if (!state.candidates.length) {
          state.stage = "unresolved";
          state.limitations.push(
            "No readable search candidates were returned; this is not proof of absence.",
          );
        }
        return await finish();
      }
      case "pages": {
        const candidate = state.candidates?.[state.nextCandidate ?? 0];
        if (!candidate) {
          state.step = "assess";
          return await finish();
        }
        if (!(await reserve("read"))) return stale;
        const result = await fetchSourceText(
          candidate.url,
          Math.min(15000, deadline - Date.now() - 1000),
        );
        if (result.status === "ready" && result.text) {
          const original = await classifyQuestionOriginal({
            url: result.resolvedUrl ?? candidate.url,
            title: candidate.title || null,
            text: result.text,
            identity: "unresolved",
            destination: "lore",
            provenance: {
              kind: "original_text",
              provider: "web",
              speaker: "unverified",
              publisher: new URL(result.resolvedUrl ?? candidate.url).hostname,
              publishedAt: result.publishedAt ?? null,
              retrievedAt: result.capturedAt,
              truncated: result.truncated,
              limitations: [
                "Search title is metadata. Publication dates, when available, are declared by the original page; they do not establish event dates or speaker identities.",
              ],
            },
          });
          state.originals = [...(state.originals ?? []), original];
        } else
          state.limitations.push(
            `Original page ${result.status}; no title or snippet was substituted.`,
          );
        state.nextCandidate = (state.nextCandidate ?? 0) + 1;
        if (state.nextCandidate >= (state.candidates?.length ?? 0)) state.step = "assess";
        return await finish();
      }
      case "social_start": {
        if (!(await reserve("social_start"))) return stale;
        state.runId = await startQuestionSocialRun(plan, state.request);
        delete state.inFlight;
        state.step = "social_poll";
        state.stage = "waiting_provider";
        return await finish();
      }
      case "social_poll": {
        if (!state.runId) throw new Error("Missing saved provider run");
        if (state.nextPollAt && Date.now() < Date.parse(state.nextPollAt)) return await finish();
        if (!(await reserve("read"))) return stale;
        const result = await checkInstagramScrape(state.runId);
        if (result.status === "ready") {
          state.datasetId = result.datasetId;
          state.step = "social_collect";
          state.stage = "reading";
        } else if (result.status === "failed") {
          state.stage = "failed";
          state.errorCode = "provider_failed";
        } else {
          // Persist backoff so browser reconnects and multiple pumps share one polling budget.
          const delay = Math.min(60000, 5000 * 2 ** Math.max(0, state.providerCalls - 2));
          state.nextPollAt = new Date(Date.now() + delay).toISOString();
        }
        return await finish();
      }
      case "social_collect": {
        if (!state.runId || !state.datasetId) throw new Error("Missing saved dataset");
        if (!(await reserve("read"))) return stale;
        const originals = await collectQuestionSocialOriginals(
          plan,
          state.request,
          job.artistId,
          state.runId,
          state.datasetId,
        );
        const selected = selectResearchReferences(
          originals.map(asOriginal),
          state.request,
          artist.name ?? "",
        );
        const ids = new Set(selected.map(r => r.sourceId));
        state.originals = originals.filter((_o, i) => ids.has(`new:${i}`)).slice(0, 3);
        state.step = "assess";
        state.limitations.push(
          "Only the bounded returned account/post window was checked; collection is not exhaustive.",
        );
        return await finish();
      }
      case "assess": {
        const originals = state.originals ?? [];
        const refs = selectResearchReferences(
          originals.map(asOriginal),
          state.request,
          artist.name ?? "",
        );
        let sufficient = false;
        if (refs.length) {
          if (!(await reserve("model"))) return stale;
          const assessment = await assessResearchEvidence(
            state.request,
            refs,
            artist,
            originals.flatMap((o, i) => (o.identity === "unresolved" ? [`new:${i}`] : [])),
            deadline - Date.now() - 1000,
          );
          delete state.inFlight;
          state.inputTokens += assessment.inputTokens;
          state.outputTokens += assessment.outputTokens;
          sufficient = assessment.sufficient;
          for (const [i, original] of originals.entries())
            if (assessment.confirmedIds.includes(`new:${i}`)) original.identity = "confirmed";
          if (assessment.limitation !== "none") state.limitations.push(assessment.limitation);
        }
        state.stage = sufficient ? "complete" : "unresolved";
        const saved = await checkpointQuestionResearch(job, state, true, async tx => {
          const retained = await persistResearchOriginals(tx, job.artistId, state, originals);
          state.references = selectResearchReferences(retained, state.request, artist.name ?? "");
          if (!state.references.length) state.stage = "unresolved";
          delete state.originals;
          delete state.candidates;
        });
        return saved
          ? { done: true, progress: researchStatusMessage(state.stage, plan.provider) }
          : stale;
      }
    }
  } catch (error) {
    if (error instanceof OwnershipChangedError) throw error;
    if (
      NoObjectGeneratedError.isInstance(error) &&
      state.inFlight === "model" &&
      (!state.step || state.step === "saved" || state.step === "assess")
    ) {
      const usage = error.usage;
      if (Number.isFinite(usage?.inputTokens))
        state.inputTokens += Math.max(0, usage!.inputTokens!);
      if (Number.isFinite(usage?.outputTokens))
        state.outputTokens += Math.max(0, usage!.outputTokens!);
      delete state.inFlight;
      state.failure = getResearchFailureDiagnostic(error, state.step);
      if (!state.outputRetries) {
        state.outputRetries = 1;
        state.stage = "checking_saved";
        return finish();
      }
    }
    state.stage = "failed";
    state.errorCode = "research_unavailable";
    state.failure = getResearchFailureDiagnostic(error, state.step);
    return finish();
  }
}
