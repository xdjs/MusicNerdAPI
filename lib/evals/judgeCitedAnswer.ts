import { generateObject } from "@/lib/ai/generateObject";
import { type AnswerVerdict } from "@/lib/evals/answerVerdictSchema";
import type { ChatTurn } from "@/lib/evals/ChatTurn";
import { prepareEvaluation } from "./attributed/prepareEvaluation";
import { diagnosticVerdictSchema } from "./attributed/diagnosticVerdictSchema";
import type { SemanticAssessment } from "./attributed/types";
import type { AttributedCapture, PreparedEvaluation } from "./attributed/types";

/** One bounded judge call; diagnostics never imply semantic support or complete inventory. */
export async function judgeCitedAnswer(input: {
  question: string;
  reference: string;
  answerable: boolean;
  turn: ChatTurn;
}): Promise<
  | {
      verdict: AnswerVerdict;
      unscoredReason?: never;
      diagnostic: PreparedEvaluation;
      rubricDiagnostic: SemanticAssessment | null;
    }
  | {
      verdict: null;
      unscoredReason: string;
      diagnostic: PreparedEvaluation;
      rubricDiagnostic: SemanticAssessment | null;
    }
> {
  const { turn } = input;
  const attribution = turn.attribution;
  if (!attribution && !turn.error && !turn.answer.trim())
    return {
      verdict: { relevance: 0, groundedness: 0, reason: "The answer is empty." },
      diagnostic: { status: "unscored", reason: "Answer is empty." },
      rubricDiagnostic: null,
    };
  if (turn.evidenceCaptureComplete === false) {
    const reason = "Complete text evidence capture is unavailable for one or more reads.";
    return {
      verdict: null,
      diagnostic: { status: "unscored", reason },
      unscoredReason: reason,
      rubricDiagnostic: null,
    };
  }
  if (
    attribution &&
    !["selecting", "complete-transport", "partial", "failed", "stopped", "unavailable"].includes(
      attribution.state,
    )
  ) {
    const reason = "Unknown attributed output state; semantic scores are unavailable.";
    return {
      verdict: null,
      rubricDiagnostic: null,
      unscoredReason: reason,
      diagnostic: { status: "unscored", reason },
    };
  }
  const diagnostic = prepareEvaluation({
    question: input.question,
    reference: input.reference,
    answerable: input.answerable,
    answer: turn.answer,
    error: turn.error,
    sources: turn.sources,
    evidence: turn.evidence,
    capture: turn.capture,
    ...(attribution
      ? {
          attributed: {
            state: attribution.state as AttributedCapture["state"],
            // A missing availability status is not proof that PDF capture succeeded.
            pdfTextUnavailable: attribution.pdfTextUnavailable !== false,
            passages: attribution.passages,
          },
        }
      : {}),
  });
  if (diagnostic.status === "unscored") {
    return {
      verdict: null,
      rubricDiagnostic: null,
      unscoredReason: diagnostic.reason,
      diagnostic,
    };
  }
  try {
    const result = await generateObject({
      instructions: `${diagnostic.instructions}\nReturn the existing relevance and groundedness scores from 0 to 1 and a concise reason. Preserve these historical metric names. Also return five independent score-and-reason rubric fields: citedSupport, requestedInventoryCoverage, counterevidenceHandling, uncertaintyHandling, responseUsability. Uncertainty must be accurate in the opening and body. Usability assesses whether the presentation helps answer the actual question rather than dumping unprioritized source text. Do not treat valid quotations as automatic success on any dimension.`,
      schema: diagnosticVerdictSchema,
      temperature: 0,
      prompt: JSON.stringify(diagnostic.payload),
    });
    const parsed = diagnosticVerdictSchema.parse(result.output);
    const { relevance, groundedness, reason, ...rubricDiagnostic } = parsed;
    return {
      verdict: { relevance, groundedness, reason },
      diagnostic,
      rubricDiagnostic,
    };
  } catch {
    return {
      verdict: null,
      rubricDiagnostic: null,
      unscoredReason: "Judge request failed; semantic scores are unavailable.",
      diagnostic,
    };
  }
}
