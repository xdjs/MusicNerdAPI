/**
 * The artist part of an export's file name.
 *
 * @param name - The artist's name.
 * @returns Lowercase ASCII letters and digits joined by hyphens; "artist" when nothing is left.
 */
export function artistFileSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "artist"
  );
}
