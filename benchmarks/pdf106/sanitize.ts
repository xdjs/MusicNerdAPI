/** Remove credentials, storage project refs and URL query strings from retained evidence. */
export function sanitize(value: string, secrets: string[]): string {
  let result = value;
  for (const secret of secrets.filter(s => s.length >= 8).sort((a, b) => b.length - a.length))
    result = result
      .split(secret)
      .join("[REDACTED]")
      .split(JSON.stringify(secret).slice(1, -1))
      .join("[REDACTED]");
  return result
    .replace(/https?:\/\/[^\s"<>]+/g, url => url.split(/[?#]/)[0])
    .replace(/[a-z0-9]+\.supabase\.co/g, "[staging-storage]")
    .replace(/Bearer\s+[\w.\-/+=]+/gi, "Bearer [REDACTED]");
}
