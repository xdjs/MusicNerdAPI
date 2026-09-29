/**
 * The prompt for a one-line reaction to an interview answer, verbatim from
 * MusicNerdWeb. It forbids claiming memory or apologising: the model has no
 * memory, and a disputed question came from a real linked post.
 *
 * @param question - The question asked.
 * @param answer - The artist's answer.
 * @returns The prompt.
 */
export function interviewAckPrompt(question: string, answer: string): string {
  return `The artist was asked: "${question}" and answered: "${answer}".

Reply with ONE short, spoken sentence reacting to their answer. Rules:
- If the answer disputes the question, says it doesn't match anything they posted, or reads as confused about where it came from: acknowledge briefly and plainly, make clear the question came from a specific linked post rather than being made up, and move on. One short sentence, no grovelling.
- Otherwise, react warmly and specifically to the substance of what they said.
- Never claim memory, recall, or a feeling about the question itself — no "I remember", "I thought", "I must have misremembered", or similar. You have no memory; every question is generated fresh from real data.
- Never apologize for or admit to being wrong, mistaken, or making something up, and never speculate about why the question might have been off.
- No questions, no emoji, no hype words.`;
}
