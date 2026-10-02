const WINDOW_MS = 60_000

/** Recent request times per bucket and key, kept in memory per instance. */
const recent = new Map<string, number[]>()

/**
 * Whether `key` may make another request in `bucket`: at most `max` a
 * minute. Best effort only, as it's per app instance.
 */
export function allow(
  bucket: string,
  key: string,
  max: number,
  now = Date.now()
) {
  const id = `${bucket}:${key}`
  const times = (recent.get(id) ?? []).filter((t) => now - t < WINDOW_MS)
  if (times.length >= max) {
    recent.set(id, times)
    return false
  }
  times.push(now)
  recent.set(id, times)
  // Don't grow forever.
  if (recent.size > 20_000)
    for (const [k, list] of recent)
      if (list.every((t) => now - t >= WINDOW_MS)) recent.delete(k)
  return true
}

/**
 * Limits per device, and much more loosely per IP: a whole party can be on
 * the same wifi, behind one address.
 */
export function allowPlayer(
  bucket: string,
  device: string,
  ip: string | null,
  perDevice: number
) {
  return (
    allow(bucket, `d:${device}`, perDevice) &&
    allow(bucket, `i:${ip ?? "unknown"}`, perDevice * 40)
  )
}
