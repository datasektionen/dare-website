import { useEffect, useState } from "react"

/**
 * The current time, updated every `intervalMs`. `null` until mounted, so
 * server and client render the same thing.
 */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const iv = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(iv)
  }, [intervalMs])
  return now
}
