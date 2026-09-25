import { client } from "@/db"
import type { BattleUpdate } from "./types"

/*
 * Fans battle updates out to every open /battle page. Updates are delivered
 * locally right away, and sent with Postgres NOTIFY so other app instances
 * hear them too (each instance ignores its own echo). Clients also drop
 * stale updates by `version`.
 */

const CHANNEL = "battle"
type Listener = (update: BattleUpdate) => void

// Kept on globalThis so dev hot reloads reuse the same subscription.
const globalForBus = globalThis as unknown as {
  battleInstance?: string
  battleListeners?: Set<Listener>
  battleListening?: Promise<unknown>
  /** Replaced on every (re)load, so the one LISTEN always runs current code. */
  battleOnNotify?: (payload: string) => void
}
globalForBus.battleInstance ??= crypto.randomUUID()
globalForBus.battleListeners ??= new Set()
const INSTANCE = globalForBus.battleInstance
const listeners = globalForBus.battleListeners

function emit(update: BattleUpdate) {
  for (const listener of listeners) listener(update)
}

globalForBus.battleOnNotify = (payload) => {
  try {
    const { origin, update } = JSON.parse(payload)
    if (origin !== INSTANCE && typeof update?.version === "number") emit(update)
  } catch {
    // Not ours or malformed; ignore.
  }
}

function ensureListening() {
  globalForBus.battleListening ??= client
    .listen(CHANNEL, (payload) => globalForBus.battleOnNotify?.(payload))
    .catch((error) => {
      // Local delivery and the clients' polling still work without it.
      console.error("LISTEN battle failed", error)
      globalForBus.battleListening = undefined
    })
}

export function subscribe(listener: Listener) {
  ensureListening()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function publish(update: BattleUpdate) {
  emit(update)
  const payload = JSON.stringify({ origin: INSTANCE, update })
  await client.notify(CHANNEL, payload).catch((error) => {
    console.error("NOTIFY battle failed", error)
  })
}
