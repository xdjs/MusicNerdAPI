import { expect, it } from "vitest";
import { isolateInterviewQuestion } from "../isolateInterviewQuestion";
it("retains the first complete ask from explicit compounds without adding a premise", () => {
  expect(
    isolateInterviewQuestion(
      "When the rhythm surprises you, what do you do next? Can you give an example?",
    ),
  ).toBe("When the rhythm surprises you, what do you do next?");
  expect(isolateInterviewQuestion("How did the take come together, and what changed later?")).toBe(
    "How did the take come together?",
  );
  expect(isolateInterviewQuestion("Which beats did you request; why those beats?")).toBe(
    "Which beats did you request?",
  );
});
it("does not split titles, noun conjunctions or already single questions", () => {
  expect(isolateInterviewQuestion("On “Why?”, how did the take happen, and what changed?")).toBe(
    "On “Why?”, how did the take happen?",
  );
  expect(isolateInterviewQuestion("How did drums and bass come together?")).toBeNull();
  expect(isolateInterviewQuestion("What about rhythm?")).toBeNull();
});
