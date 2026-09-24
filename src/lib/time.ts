/** All times on the site are shown and entered in Swedish time. */
export const TIME_ZONE = "Europe/Stockholm"

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

function zonedParts(date: Date) {
  const p = Object.fromEntries(
    partsFormatter.formatToParts(date).map((x) => [x.type, x.value])
  )
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  }
}

/** Offset of Swedish time from UTC at `date`, in ms (+1h or +2h). */
function offsetAt(date: Date) {
  const p = zonedParts(date)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/**
 * The instant for a Swedish wall-clock time. `date` is `YYYY-MM-DD`, `time`
 * is `HH:MM`. Handles daylight saving time.
 */
export function fromSwedishTime(date: string, time: string): Date {
  const [y, mo, d] = date.split("-").map(Number)
  const [h, mi] = time.split(":").map(Number)
  const wall = Date.UTC(y, mo - 1, d, h, mi)
  // Guess with the offset at the wall time, then correct once for DST.
  let utc = wall - offsetAt(new Date(wall))
  utc = wall - offsetAt(new Date(utc))
  return new Date(utc)
}

/** Swedish wall-clock date (`YYYY-MM-DD`) and time (`HH:MM`) of `at`. */
export function toSwedishTime(at: Date) {
  const p = zonedParts(at)
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  }
}

/** E.g. "Onsdag 4 november 2026 · 20:00" / "Wednesday 4 November 2026 · 20:00". */
export function formatRelease(at: Date, lang: "sv" | "en") {
  const locale = lang === "sv" ? "sv-SE" : "en-GB"
  const day = new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
    .format(at)
    .replace(",", "")
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at)
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`
}

/** Splits a duration into days, hours, minutes and seconds. */
export function splitDuration(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(t / 86400),
    hours: Math.floor(t / 3600) % 24,
    minutes: Math.floor(t / 60) % 60,
    seconds: t % 60,
  }
}

const relative = new Intl.RelativeTimeFormat("sv", { numeric: "auto" })
// Days rather than weeks/months: "om 41 dagar" reads better for a countdown.
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536e6],
  ["day", 864e5],
  ["hour", 36e5],
  ["minute", 6e4],
]

/** E.g. "om 41 dagar", "för 5 minuter sedan", "nu". */
export function formatRelative(at: Date, now: number) {
  const diff = at.getTime() - now
  for (const [unit, ms] of UNITS)
    if (Math.abs(diff) >= ms)
      return relative.format(Math.round(diff / ms), unit)
  return "nu"
}

/** E.g. "24 sep. 2026 19:40". */
export function formatShort(at: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at)
}
