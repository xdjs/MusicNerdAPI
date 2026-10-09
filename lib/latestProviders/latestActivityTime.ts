/** Sort incomplete dates at their known period end, never fabricate a publication day. */
export function latestActivityTime(value: string): number {
  const parts = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!parts) return Date.parse(value);
  const year = Number(parts[1]),
    month = parts[2] ? Number(parts[2]) : 12;
  if (year < 1000 || month < 1 || month > 12) return NaN;
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (!parts[3]) return Date.UTC(year, month, 1) - 1;
  const day = Number(parts[3]);
  return day >= 1 && day <= maxDay ? Date.UTC(year, month - 1, day) : NaN;
}
