import { getRequestIP } from "@tanstack/react-start/server"

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 5

/** Recent submission times per client IP, kept in memory per instance. */
const recent = new Map<string, number[]>()

/**
 * Whether this client may save another score: at most 5 a minute. Best
 * effort only, as it's per app instance and IPs can be shared or spoofed.
 */
export function allowSubmission(now = Date.now()) {
  const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown"
  const times = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (times.length >= MAX_PER_WINDOW) {
    recent.set(ip, times)
    return false
  }
  times.push(now)
  recent.set(ip, times)
  // Don't grow forever.
  if (recent.size > 10_000)
    for (const [key, list] of recent)
      if (list.every((t) => now - t >= WINDOW_MS)) recent.delete(key)
  return true
}
