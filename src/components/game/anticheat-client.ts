import type { CLIENT_FLAGS } from "@/lib/game/anticheat"

/*
 * The browser's half of Puckopist's anticheat (see `@/lib/game/anticheat`):
 * spotting developer tools and swapped-out timers, a fingerprint to tell
 * devices apart, and the run's HMAC. None of this can stop a determined
 * player on its own (it all runs on their computer); it flags runs for an
 * admin to look at. The real check is the server replaying the run.
 */

export type ClientFlag = (typeof CLIENT_FLAGS)[number]

const isNative = (f: unknown) =>
  typeof f === "function" &&
  /\{\s*\[native code\]\s*\}\s*$/.test(Function.prototype.toString.call(f))

/** Whether the clocks and the frame loop the game runs on are the real ones. */
function timersHooked() {
  return ![
    window.requestAnimationFrame,
    performance.now,
    Date.now,
    window.setTimeout,
    Function.prototype.toString,
  ].every(isNative)
}

/**
 * A worker that hits a `debugger` statement twice a second and reports how
 * long it took. With the developer tools closed that's nothing; with them
 * open the browser pauses there, so the reply comes late or not at all.
 * Unlike tricks with the console or the window's size, nothing else
 * (extensions, side panels, zoom, React's own console wrapping) sets it off.
 * It runs in a worker so the game itself never pauses.
 */
const PROBE = `setInterval(() => {
  const t = performance.now()
  debugger
  postMessage(performance.now() - t)
}, 500)`

/** Calls `onOpen` when the developer tools are open. Returns a stop function. */
function watchDevtools(onOpen: () => void) {
  let worker: Worker
  try {
    const url = URL.createObjectURL(
      new Blob([PROBE], { type: "text/javascript" })
    )
    worker = new Worker(url)
    URL.revokeObjectURL(url)
  } catch {
    // No workers (or blocked): no check.
    return () => {}
  }
  let lastReply = performance.now()
  worker.onmessage = (e: MessageEvent<number>) => {
    lastReply = performance.now()
    // It paused on the debugger statement, then someone resumed it.
    if (e.data > 250) onOpen()
  }
  // Still paused: no reply for a while. Only while this page runs smoothly
  // and is in front, as browsers slow down timers in background tabs.
  let lastTick = performance.now()
  const timer = setInterval(() => {
    const now = performance.now()
    const smooth = now - lastTick < 1500
    lastTick = now
    // After a hidden or stalled page, give the worker a fresh start.
    if (!smooth || document.hidden) lastReply = now
    else if (now - lastReply > 3000) onOpen()
  }, 500)
  return () => {
    clearInterval(timer)
    worker.terminate()
  }
}

/** Watches for tampering while a run is on. */
export function watchRun() {
  const flags = new Set<ClientFlag>()
  const check = () => {
    try {
      if (timersHooked()) flags.add("hooked")
    } catch {
      // A check that breaks says nothing either way.
    }
  }
  check()
  const timer = setInterval(check, 1500)
  const stopDevtools = watchDevtools(() => flags.add("devtools"))
  return {
    flags: () => [...flags],
    stop: () => {
      clearInterval(timer)
      stopDevtools()
    },
  }
}

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join(
    ""
  )

/**
 * A SHA-256 of this browser's traits (screen, language, time zone, graphics
 * card, how it draws text), which stays the same when cookies are cleared.
 * Null where Web Crypto isn't available.
 */
export async function fingerprint(): Promise<string | null> {
  if (!crypto.subtle) return null
  const traits: unknown[] = [
    navigator.userAgent,
    navigator.languages?.join(","),
    navigator.hardwareConcurrency,
    (navigator as { deviceMemory?: number }).deviceMemory,
    navigator.maxTouchPoints,
    screen.width,
    screen.height,
    screen.colorDepth,
    devicePixelRatio,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ]
  try {
    const c = document.createElement("canvas")
    c.width = 220
    c.height = 40
    const g = c.getContext("2d")
    if (g) {
      g.textBaseline = "top"
      g.font = "16px 'Arial'"
      g.fillStyle = "#e83d84"
      g.fillRect(100, 1, 62, 20)
      g.fillStyle = "#069"
      g.fillText("dÅre Puckopist ⛷ 27", 2, 15)
      traits.push(c.toDataURL())
    }
    const gl = document.createElement("canvas").getContext("webgl")
    const info = gl?.getExtension("WEBGL_debug_renderer_info")
    if (gl && info)
      traits.push(
        gl.getParameter(info.UNMASKED_VENDOR_WEBGL),
        gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
      )
  } catch {
    // Blocked by the browser: go without.
  }
  const data = new TextEncoder().encode(JSON.stringify(traits))
  return hex(await crypto.subtle.digest("SHA-256", data))
}

/** HMAC-SHA256 of `message` with the run's hex `key`; "" without Web Crypto. */
export async function sign(key: string, message: string) {
  if (!crypto.subtle) return ""
  const bytes = new Uint8Array(
    key.match(/../g)?.map((b) => Number.parseInt(b, 16)) ?? []
  )
  const k = await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  return hex(
    await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(message))
  )
}
