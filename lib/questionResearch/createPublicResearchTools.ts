import { tool } from "ai";
import { z } from "zod";
import { getEligibleResearchOriginals } from "./getEligibleResearchOriginals";
import { diversifyResearchOriginals } from "./diversifyResearchOriginals";
import { selectResearchReferences } from "./selectResearchReferences";
import { researchPlatformForUrl } from "./researchPlatformForUrl";
import { latestActivityTime } from "@/lib/latestProviders/latestActivityTime";
import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";
import type {
  ResearchFacetCoverage,
  ResearchOriginal,
  ResearchRequest,
  ResearchReference,
  ResearchPlan,
} from "./types";

const reason = z.enum([
  "missing_original",
  "missing_qualification",
  "unsupported_speech",
  "date_or_edition_uncertain",
]);
const MAX_TOOL_CALLS = 12;
const RESERVED_COMPLETION_TOOL_CALLS = 2;
const MAX_EXPLORATION_TOOL_CALLS = MAX_TOOL_CALLS - RESERVED_COMPLETION_TOOL_CALLS;
type Outcome = {
  sufficient: boolean;
  /** Saved evidence selection was explicitly finished; partial facet coverage is terminal too. */
  finishedEvidence?: true;
  references: ResearchReference[];
  nextLookup: ResearchPlan["provider"];
  limitation: string;
  facetCoverage?: ResearchFacetCoverage;
};

/** Read-only tools over an already public snapshot. No private knowledge or provider I/O. */
export function createPublicResearchTools(
  originals: ResearchOriginal[],
  request: ResearchRequest,
  artistName: string,
  lookups: ResearchPlan[],
) {
  const eligible = getEligibleResearchOriginals(originals, request);
  const providerOf = (o: ResearchOriginal) =>
    researchPlatformForUrl(o.url) ?? new URL(o.url).hostname;
  const timeOf = (o: ResearchOriginal) =>
    latestActivityTime(o.activityDate ?? o.publishedAt ?? "") || 0;
  const chronological = [...eligible].sort(
    (a, b) => timeOf(b) - timeOf(a) || a.sourceId.localeCompare(b.sourceId),
  );
  const groups = new Map<string, ResearchOriginal[]>();
  for (const source of chronological) {
    const provider = providerOf(source);
    const group = groups.get(provider) ?? [];
    group.push(source);
    groups.set(provider, group);
  }
  // Interleave source families for browsing, while retaining every original and per-provider chronology.
  const diverse = diversifyResearchOriginals(chronological);
  const read = new Map<string, ResearchReference>();
  let outcome: Outcome | undefined;
  let toolCalls = 0;
  let explorationToolCalls = 0;
  let readChars = 0;
  let evidenceBudgetExhausted = false;
  const calls: string[] = [];
  let rejectedIdCount = 0;
  const mapFacetCoverage = (
    referenceIds: string[],
    requested: { id: string; referenceIds: string[] }[] | undefined,
  ): ResearchFacetCoverage | null | undefined => {
    const facets = request.evidenceFacets;
    if (!facets) return requested === undefined || requested.length === 0 ? undefined : null;
    if (!requested || requested.length !== facets.length) return null;
    const selected = new Set(referenceIds);
    const allAssigned = new Set<string>();
    for (const [index, facet] of facets.entries()) {
      const row = requested[index];
      if (
        row.id !== facet.id ||
        new Set(row.referenceIds).size !== row.referenceIds.length ||
        row.referenceIds.some(id => !selected.has(id))
      )
        return null;
      for (const id of row.referenceIds) {
        if (!read.has(id)) return null;
        allAssigned.add(id);
      }
    }
    if (allAssigned.size !== selected.size || [...selected].some(id => !allAssigned.has(id)))
      return null;
    return facets.map((facet, index) => ({
      id: facet.id,
      referenceIndexes: requested[index]!.referenceIds.map(id => referenceIds.indexOf(id)),
    }));
  };
  const remainingToolBudget = () => {
    const remainingToolCalls = Math.max(0, MAX_TOOL_CALLS - toolCalls);
    return {
      remainingToolCalls,
      remainingExplorationCalls: Math.min(
        remainingToolCalls,
        Math.max(0, MAX_EXPLORATION_TOOL_CALLS - explorationToolCalls),
      ),
      remainingCompletionCalls: remainingToolCalls,
    };
  };
  const reserve = (name: string, phase: "exploration" | "completion" = "exploration") => {
    if (outcome) return { error: "already_finished", ...remainingToolBudget() };
    if (phase === "exploration" && explorationToolCalls >= MAX_EXPLORATION_TOOL_CALLS)
      return { error: "exploration_tool_budget_exhausted", ...remainingToolBudget() };
    if (toolCalls >= MAX_TOOL_CALLS)
      return { error: "tool_budget_exhausted", ...remainingToolBudget() };
    if (phase === "exploration") explorationToolCalls++;
    toolCalls++;
    calls.push(name);
    return null;
  };
  const register = (references: ResearchReference[]) =>
    references.flatMap(reference => {
      const remaining = 24000 - readChars;
      if (remaining < Math.min(reference.text.length, 256)) {
        evidenceBudgetExhausted = true;
        return [];
      }
      const original = eligible.find(
        o => o.sourceId === reference.sourceId && o.revision === reference.revision,
      )!;
      const window = knowledgeWindow(
        original.text,
        reference.start,
        Math.min(reference.text.length, remaining),
      );
      const exact = { ...original, ...window };
      readChars += exact.text.length;
      if (readChars >= 24000 || exact.text.length < reference.text.length)
        evidenceBudgetExhausted = true;
      const referenceId = `read:${read.size}`;
      read.set(referenceId, exact);
      return [
        {
          referenceId,
          ...exact,
          totalChars: original.text.length,
          hasMore: exact.end < original.text.length,
        },
      ];
    });
  const inventory = {
    eligibleSources: eligible.length,
    providers: [...groups].slice(0, 50).map(([provider, sources]) => ({
      provider,
      count: sources.length,
      newestDate: sources[0]?.activityDate ?? sources[0]?.publishedAt ?? null,
    })),
    providerListTruncated: groups.size > 50,
  };
  const tools = {
    browseSources: tool({
      description:
        "Browse saved originals. Default order interleaves providers, newest first within each; filter provider for its chronology. Previews are discovery only; read before selecting. Text returned counts against the 24,000-character budget. Check remainingReadChars before further reads. Continue with nextOffset.",
      inputSchema: z.object({
        offset: z.number().int().min(0).max(5000).default(0),
        provider: z.string().max(200).optional(),
      }),
      execute: async ({ offset, provider }) => {
        const blocked = reserve("browse");
        if (blocked) return { ...blocked, remainingReadChars: Math.max(0, 24000 - readChars) };
        const sources = provider ? chronological.filter(o => providerOf(o) === provider) : diverse;
        const page = sources.slice(offset, offset + 12);
        const listedSources = page.map(o => {
          const preview = o.text.slice(0, Math.max(0, Math.min(220, 24000 - readChars)));
          readChars += preview.length;
          if (readChars >= 24000 || preview.length < Math.min(220, o.text.length))
            evidenceBudgetExhausted = true;
          return {
            sourceId: o.sourceId,
            revision: o.revision,
            provider: providerOf(o),
            url: o.url,
            date: o.activityDate ?? o.publishedAt,
            kind: o.evidenceKind,
            totalChars: o.text.length,
            preview,
          };
        });
        return {
          total: sources.length,
          nextOffset: offset + page.length < sources.length ? offset + page.length : null,
          sources: listedSources,
          remainingReadChars: Math.max(0, 24000 - readChars),
        };
      },
    }),
    searchSources: tool({
      description:
        "Search the body text of all eligible saved originals, not publisher domains or site metadata. For provider-specific exploration, use browseSources with a provider filter from the inventory. Returns compact original windows anchored near keyword passages with exact offsets; use readSources for more context. Text returned counts against the 24,000-character budget. Check remainingReadChars and avoid repeating searches that returned the same passages.",
      inputSchema: z.object({ query: z.string().min(1).max(300) }),
      execute: async ({ query }) => {
        const blocked = reserve("search");
        if (blocked) return { ...blocked, remainingReadChars: Math.max(0, 24000 - readChars) };
        if (24000 - readChars < 256) {
          evidenceBudgetExhausted = true;
          return {
            error: "evidence_budget_exhausted",
            remainingReadChars: Math.max(0, 24000 - readChars),
          };
        }
        const references = selectResearchReferences(
          eligible,
          { ...request, topic: query, retrieval: "relevance", freshness: "stored" },
          artistName,
          Date.now(),
          { mode: "navigation-context" },
        );
        const registeredReferences = register(references);
        return {
          searchedSources: eligible.length,
          references: registeredReferences,
          exhaustive: false,
          remainingReadChars: Math.max(0, 24000 - readChars),
        };
      },
    }),
    readSources: tool({
      description:
        "Read original text for source IDs found by browsing/search. start is an exact UTF-16 offset; use the previous reference end to continue without repeating text. Returns up to 4,000 chars per source, 12,000 per call, within the 24,000-character total text budget. Check remainingReadChars before further reads. Only returned read reference IDs can finish evidence selection.",
      inputSchema: z.object({
        sources: z
          .array(
            z.object({ sourceId: z.string().max(200), start: z.number().int().min(0).default(0) }),
          )
          .min(1)
          .max(6),
      }),
      execute: async ({ sources }) => {
        const blocked = reserve("read");
        if (blocked) return { ...blocked, remainingReadChars: Math.max(0, 24000 - readChars) };
        if (24000 - readChars < 256) {
          evidenceBudgetExhausted = true;
          return {
            error: "evidence_budget_exhausted",
            remainingReadChars: Math.max(0, 24000 - readChars),
          };
        }
        const resolved = sources.map(s => ({
          ...s,
          original: eligible.find(o => o.sourceId === s.sourceId),
        }));
        if (resolved.some(s => !s.original || s.start >= s.original.text.length))
          return {
            error: "source_unavailable",
            remainingReadChars: Math.max(0, 24000 - readChars),
          };
        const size = Math.min(4000, Math.floor(12000 / sources.length));
        const registeredReferences = register(
          resolved.map(s => ({
            ...s.original!,
            ...knowledgeWindow(s.original!.text, s.start, size),
          })),
        );
        return {
          references: registeredReferences,
          remainingReadChars: Math.max(0, 24000 - readChars),
        };
      },
    }),
    finishEvidence: tool({
      description:
        "Finish with supporting read reference IDs. Select useful, relevant originals with surrounding qualifications. This selects evidence; the answer is drafted and verified separately. For each requested positive evidence facet, assign the actual read reference IDs that support it; use an empty list when none of the selected references support that facet. A reference may support more than one facet. Do not infer support from a source you did not read.",
      inputSchema: z.strictObject({
        referenceIds: z.array(z.string().max(200)).min(1).max(6),
        facetCoverage: z
          .array(
            z.strictObject({
              id: z.string().max(4),
              referenceIds: z.array(z.string().max(200)).max(6),
            }),
          )
          .max(4)
          .optional(),
      }),
      execute: async ({ referenceIds, facetCoverage }) => {
        const blocked = reserve("finish", "completion");
        if (blocked) return blocked;
        const ids = [...new Set(referenceIds)];
        if (ids.some(id => !read.has(id))) {
          rejectedIdCount += ids.filter(id => !read.has(id)).length;
          return {
            error: "unread_reference",
            availableReferenceIds: [...read.keys()],
            ...remainingToolBudget(),
          };
        }
        const references = ids.map(id => read.get(id)!);
        const mappedCoverage = mapFacetCoverage(ids, facetCoverage);
        if (mappedCoverage === null)
          return {
            error: "invalid_facet_coverage",
            availableFacetIds: request.evidenceFacets?.map(f => f.id) ?? [],
          };
        const limit =
          request.answerScope === "overview" && request.evidenceNeed === "reporting" ? 3 : 6;
        if (
          references.length > limit ||
          references.reduce((sum, r) => sum + r.text.length, 0) > 12000
        )
          return { error: "selection_too_large", maxReferences: limit, maxChars: 12000 };
        outcome = {
          sufficient:
            !mappedCoverage || mappedCoverage.every(row => row.referenceIndexes.length > 0),
          finishedEvidence: true,
          references,
          nextLookup: null,
          limitation: "none",
          ...(mappedCoverage ? { facetCoverage: mappedCoverage } : {}),
        };
        return { status: "complete" };
      },
    }),
    requestLookup: tool({
      description:
        "Choose an available outside lookup only when saved evidence cannot answer. This records a choice; it does not execute research. Available choices are in the request. Retain useful partial support in referenceIds so new research can be combined with it.",
      inputSchema: z.object({
        provider: z.string().max(50),
        reason,
        referenceIds: z.array(z.string().max(200)).max(3).optional(),
      }),
      execute: async ({ provider, reason, referenceIds = [] }) => {
        const blocked = reserve("lookup", "completion");
        if (blocked) return blocked;
        if (eligible.length && !read.size) return { error: "read_saved_sources_first" };
        if (evidenceBudgetExhausted) return { error: "evidence_budget_exhausted" };
        const plan = lookups.find(p => p.provider === provider);
        if (!plan) return { error: "lookup_unavailable" };
        const ids = [...new Set(referenceIds)];
        if (ids.some(id => !read.has(id))) return { error: "unread_reference" };
        outcome = {
          sufficient: false,
          references: ids.map(id => read.get(id)!),
          nextLookup: plan.provider,
          limitation: reason,
        };
        return { status: "lookup_selected" };
      },
    }),
    finishUnresolved: tool({
      description:
        "Finish when inspected saved evidence cannot establish the answer and no available lookup can help. Do not use this for a time, tool or context limit.",
      inputSchema: z.object({ reason }),
      execute: async ({ reason }) => {
        const blocked = reserve("unresolved", "completion");
        if (blocked) return blocked;
        if (eligible.length && !read.size) return { error: "read_saved_sources_first" };
        if (evidenceBudgetExhausted) return { error: "evidence_budget_exhausted" };
        outcome = { sufficient: false, references: [], nextLookup: null, limitation: reason };
        return { status: "unresolved" };
      },
    }),
  };
  return {
    tools,
    inventory,
    outcome: () => outcome,
    trace: () => ({
      eligibleSources: eligible.length,
      toolCalls,
      readChars,
      calls: [...calls],
      readSourceIds: [...new Set([...read.values()].map(r => r.sourceId))],
      rejectedIdCount,
      stopReason: outcome?.sufficient
        ? "supported"
        : outcome?.nextLookup
          ? "outside_lookup"
          : outcome
            ? "insufficient"
            : "incomplete",
    }),
  };
}
