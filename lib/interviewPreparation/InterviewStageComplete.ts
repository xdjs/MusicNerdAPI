/** Control flow: a paid stage is checkpointed before another worker slice begins. */
export class InterviewStageComplete extends Error {
  constructor() {
    super("Interview stage complete");
  }
}
