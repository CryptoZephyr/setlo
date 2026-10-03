const tzName = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** "Sat 14 Nov 2026, 18:00 (Europe/London)" */
export function dateTime(sec: number, opts: { tz?: boolean } = {}): string {
  const s = new Date(sec * 1000).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return opts.tz === false ? s : `${s} (${tzName()})`;
}

export function timeZone() {
  return tzName();
}

/** Human duration, e.g. "2 d 4 h", "12 min", "45 s". */
export function duration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s >= 86400) return `${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h`;
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
  if (s >= 60) return `${Math.floor(s / 60)} min`;
  return `${s} s`;
}
