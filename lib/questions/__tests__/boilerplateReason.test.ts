import { describe, it, expect } from "vitest";
import { boilerplateReason } from "@/lib/questions/boilerplateReason";

describe("boilerplateReason", () => {
  it.each([
    "Across 22 posts, you've credited @bycherele for creative direction; what changed?",
    "You've credited @zavodskyalan as your main production partner across 23 posts; what next?",
    "You've credited @lemieu_x on 12 posts; what stuck?",
    "You've mentioned them across many posts; what shifted?",
  ])("rejects counting how often something appears: %s", q => {
    expect(boilerplateReason(q)).toMatch(/counts/);
  });

  it.each([
    "You've credited @x for direction; what's a specific moment where their input shaped a project?",
    "What's one specific detail they brought to the mix?",
    "Can you name a particular instance where that mattered?",
  ])("rejects handing the artist the job of being specific: %s", q => {
    expect(boilerplateReason(q)).toMatch(/specificity/);
  });

  it.each([
    "What was the process like for that track to be selected?",
    "What was that experience like?",
  ])("rejects these one way or another: %s", q => {
    expect(boilerplateReason(q)).not.toBeNull();
  });

  it.each(["what was it like working with them?", "What was that first night like?"])(
    "rejects the what-was-it-like family: %s",
    q => {
      expect(boilerplateReason(q)).toMatch(/what something was like/);
    },
  );

  it.each([
    "what does that look like in practice for artists using the platform?",
    "what was a key creative decision that shaped the visual identity of the project?",
    "how did that change your approach to songwriting?",
    "what has that journey been like for you?",
  ])("rejects essay-register abstractions: %s", q => {
    expect(boilerplateReason(q)).toMatch(/abstraction/);
  });

  it("rejects a question too long to say out loud", () => {
    expect(
      boilerplateReason(
        "You wrote that your cousin André handing you 112's Part III and Dr. Dre's 2001 shifted your perspective on how to create music; what was the first track you made where you felt that shift truly take hold?",
      ),
    ).toMatch(/too long/);
  });

  it.each([
    "what does an artist actually get that they didn't have before?",
    "what did she want that you argued with?",
    "What was the first thing you changed after he handed you those albums?",
    "What did the label want that you would not give them?",
    "You wrote that the pandemic was a blessing and a curse; who told you to slow down?",
    "Alan's 808s for that outro were lost — did you try to rebuild them, or was leaving it the point?",
    "You called @lemieu_x your mixer; which of their calls did you argue with?",
    "You said those two albums changed how you make music — what's the first thing you made after?",
  ])("keeps a question that names something real: %s", q => {
    expect(boilerplateReason(q)).toBeNull();
  });
});
