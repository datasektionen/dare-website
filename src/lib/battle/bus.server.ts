import { client } from "@/db"
import { readBattle } from "./state.server"
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
  let first = true
  globalForBus.battleListening ??= client
    .listen(
      CHANNEL,
      (payload) => globalForBus.battleOnNotify?.(payload),
      // Runs again whenever postgres.js re-listens after losing the
      // connection: send everyone the score, in case other instances
      // scored in the meantime.
      () => {
        if (first) {
          first = false
          return
        }
        readBattle().then(
          (state) => emit({ ...state, event: null }),
          () => {}
        )
      }
    )
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
