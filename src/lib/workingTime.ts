// Working-time calculator for Europe/Kyiv business hours.
// Timer counts only 10:00–19:00 Kyiv local time. Outside that window time is frozen.

const TZ = "Europe/Kyiv";
const WORK_START_HOUR = 10;
const WORK_END_HOUR = 19;

function kyivParts(ts: number) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const o: Record<string, string> = {};
  dtf.formatToParts(new Date(ts)).forEach((p) => {
    if (p.type !== "literal") o[p.type] = p.value;
  });
  return {
    year: +o.year,
    month: +o.month,
    day: +o.day,
    hour: +o.hour === 24 ? 0 : +o.hour,
    minute: +o.minute,
    second: +o.second,
  };
}

function kyivOffsetMs(ts: number) {
  const p = kyivParts(ts);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - ts;
}

// Convert a Kyiv wall-clock time to a UTC timestamp
function kyivWallToUtc(y: number, m: number, d: number, h: number, min: number) {
  const naive = Date.UTC(y, m - 1, d, h, min);
  // First approximation using +2, then correct using real offset at that instant
  let guess = naive - 2 * 3600 * 1000;
  const off = kyivOffsetMs(guess);
  guess = naive - off;
  return guess;
}

/**
 * Returns elapsed working-time (ms) between two timestamps,
 * counting only 10:00–19:00 Kyiv time.
 */
export function workingElapsedMs(startMs: number, endMs: number): number {
  if (!isFinite(startMs) || !isFinite(endMs) || endMs <= startMs) return 0;
  let total = 0;
  let cursor = startMs;
  // Safety bound: max ~5 years of days
  for (let i = 0; i < 2000 && cursor < endMs; i++) {
    const p = kyivParts(cursor);
    const winStart = kyivWallToUtc(p.year, p.month, p.day, WORK_START_HOUR, 0);
    const winEnd = kyivWallToUtc(p.year, p.month, p.day, WORK_END_HOUR, 0);
    const nextDayStart = kyivWallToUtc(p.year, p.month, p.day + 1, 0, 0);
    const segEnd = Math.min(endMs, nextDayStart);
    const a = Math.max(cursor, winStart);
    const b = Math.min(segEnd, winEnd);
    if (b > a) total += b - a;
    cursor = segEnd;
  }
  return total;
}
