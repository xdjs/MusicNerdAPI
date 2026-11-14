/**
 * The strings to search for a question: the question itself and, when it names the artist by none
 * of their names, the question with the first name appended, so pages that only say the name match.
 *
 * @param question - The user's question.
 * @param names - The artist's names, the display name first.
 */
export function expandSearchQueries(question: string, names: string[]): string[] {
  const name = names[0]?.trim();
  const lower = question.toLowerCase();
  const named = names.some(n => n.trim() && lower.includes(n.trim().toLowerCase()));
  return name && !named ? [question, `${question} ${name}`] : [question];
}
