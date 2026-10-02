import { type QueryClient, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useSyncExternalStore } from "react"
import { battleQuery } from "./queries"
import type { BattleState, BattleUpdate } from "./types"

/*
 * Live battle updates, with at most ONE server connection per browser.
 *
 * Browsers only allow ~6 HTTP/1.1 connections per host, shared by all tabs.
 * An EventSource per tab would use them up with a few /battle windows open,
 * and then every other request (like an admin's +1) would hang. So one tab
 * holds a Web Lock and owns the EventSource, and passes updates to the other
 * tabs over a BroadcastChannel. When it closes, another tab takes over.
 *
 * These screens run for hours on flaky party wifi, so the connection looks
 * after itself:
 * - The server pings every 15 s. If nothing arrives for a while the
 *   connection is assumed dead (wifi switched, laptop slept, a proxy dropped
 *   it silently) and reopened.
 * - EventSource retries network errors itself, but gives up for good on an
 *   HTTP error (a 502 during a deploy). Then it's reopened by hand, backing
 *   off up to 15 s.
 * - The server sends the current score first on every connection, so a
 *   reconnect catches up on anything missed.
 * - A tab whose leader goes quiet (frozen in the background, say) steals the
 *   lock while it's visible, and the old leader steps down.
 * The pages also poll as a last resort.
 */

const LOCK = "dare-battle-stream"
const CHANNEL = "dare-battle"
const SOURCE_URL = "/api/battle/events"
/** No ping for this long and the connection is assumed dead. */
const DEAD_MS = 40_000
/** A visible tab takes over when the leader has been quiet this long. */
const STEAL_MS = 50_000
/** Shown as offline after this long without word from the server. */
const OFFLINE_MS = 8_000

type Message =
  | { type: "update"; update: BattleUpdate }
  /** The leader's connection works (sent on every ping and update). */
  | { type: "alive" }
  /** The leader lost its connection. */
  | { type: "down" }
  /** A new tab asks how the leader is doing. */
  | { type: "hello" }

type Handler = (update: BattleUpdate) => void

const handlers = new Set<Handler>()
let started = false
let channel: BroadcastChannel | null = null
let queryClient: QueryClient | null = null

function deliver(update: BattleUpdate) {
  if (typeof update?.version !== "number") return
  if (queryClient) applyUpdate(queryClient, update)
  for (const handler of handlers) handler(update)
}

// Connection status, for the offline badge. Online while this tab's own
// connection is open, or until `aliveUntil` (a grace period after a drop,
// or for a follower, until the leader's next ping is overdue).
let connected = false
let aliveUntil = 0
let online = true
const statusListeners = new Set<() => void>()

function setConnected(value: boolean) {
  if (connected && !value) aliveUntil = Date.now() + OFFLINE_MS
  connected = value
  refreshOnline()
}
function heardFromLeader() {
  aliveUntil = Date.now() + DEAD_MS
  refreshOnline()
}
function refreshOnline() {
  const next = connected || Date.now() < aliveUntil
  if (next === online) return
  online = next
  for (const listener of statusListeners) listener()
}

/** Runs the EventSource until `stop` is called. */
function lead() {
  let source: EventSource | null = null
  let retry: ReturnType<typeof setTimeout> | undefined
  let attempt = 0
  let lastSeen = Date.now()

  const alive = () => {
    lastSeen = Date.now()
    attempt = 0
    setConnected(true)
    channel?.postMessage({ type: "alive" } satisfies Message)
  }
  const down = () => {
    setConnected(false)
    channel?.postMessage({ type: "down" } satisfies Message)
  }
  const open = () => {
    clearTimeout(retry)
    source?.close()
    lastSeen = Date.now()
    const s = new EventSource(SOURCE_URL)
    source = s
    s.onopen = alive
    s.addEventListener("ping", alive)
    s.onmessage = (e) => {
      alive()
      let update: BattleUpdate
      try {
        update = JSON.parse(e.data)
      } catch {
        return
      }
      deliver(update)
      channel?.postMessage({ type: "update", update } satisfies Message)
    }
    s.onerror = () => {
      down()
      // CONNECTING: the browser retries by itself. CLOSED: it gave up.
      if (s.readyState === EventSource.CLOSED) reopenLater()
    }
  }
  const reopenLater = () => {
    source?.close()
    clearTimeout(retry)
    const delay = Math.min(1000 * 2 ** attempt, 15_000)
    attempt++
    retry = setTimeout(open, delay * (0.75 + Math.random() * 0.5))
  }
  const watchdog = setInterval(() => {
    if (Date.now() - lastSeen > DEAD_MS) {
      down()
      open()
    }
  }, 5000)
  // Coming back (wifi on again, laptop woken): don't wait for the watchdog.
  const wake = () => {
    if (document.visibilityState === "hidden") return
    if (!connected || Date.now() - lastSeen > 20_000) open()
  }
  addEventListener("online", wake)
  document.addEventListener("visibilitychange", wake)
  const answer = (e: MessageEvent<Message>) => {
    if (e.data?.type !== "hello") return
    channel?.postMessage({
      type: connected ? "alive" : "down",
    } satisfies Message)
  }
  channel?.addEventListener("message", answer)

  open()
  return () => {
    clearInterval(watchdog)
    clearTimeout(retry)
    removeEventListener("online", wake)
    document.removeEventListener("visibilitychange", wake)
    channel?.removeEventListener("message", answer)
    source?.close()
    source = null
  }
}

/** Starts listening once per tab. Never stopped: it's cheap when idle. */
function start() {
  if (started) return
  started = true
  aliveUntil = Date.now() + OFFLINE_MS
  setInterval(refreshOnline, 2000)

  channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL) : null
  if (!navigator.locks || !channel) {
    lead()
    return
  }

  let leading = false
  let leaderSeen = Date.now()
  channel.onmessage = (e: MessageEvent<Message>) => {
    if (leading) return
    const message = e.data
    if (message?.type === "hello") return
    // A leader that's reconnecting is still alive: no need to take over.
    leaderSeen = Date.now()
    if (message?.type === "down") {
      aliveUntil = Math.min(aliveUntil, Date.now() + OFFLINE_MS)
      return refreshOnline()
    }
    heardFromLeader()
    if (message?.type === "update") deliver(message.update)
  }

  // This tab's place in the queue for the lock.
  let waiting: AbortController | null = null
  const campaign = (steal: boolean) => {
    // Never queue twice, or this tab could end up leading twice.
    waiting?.abort()
    const queued = new AbortController()
    waiting = steal ? null : queued
    let stop: (() => void) | undefined
    navigator.locks
      .request(
        LOCK,
        steal ? { steal: true } : { signal: queued.signal },
        () => {
          if (waiting === queued) waiting = null
          leading = true
          stop = lead()
          // Held until this tab closes (or another tab steals it).
          return new Promise<never>(() => {})
        }
      )
      .catch(() => {
        // Left the queue for a steal: nothing to undo.
        if (!stop) return
        // Stolen: step down and wait in line again.
        leading = false
        stop()
        setConnected(false)
        leaderSeen = Date.now()
        campaign(false)
      })
  }
  campaign(false)
  channel.postMessage({ type: "hello" } satisfies Message)

  // A frozen or broken leader still holds the lock: take over while visible.
  setInterval(() => {
    if (leading || document.visibilityState !== "visible") return
    if (Date.now() - leaderSeen < STEAL_MS) return
    leaderSeen = Date.now()
    campaign(true)
  }, 5000)
}

function applyUpdate(queryClient: QueryClient, update: BattleUpdate) {
  const current = queryClient.getQueryData<BattleState>(battleQuery.queryKey)
  if (current && update.version <= current.version) return
  const { event: _event, ...state } = update
  queryClient.setQueryData(battleQuery.queryKey, state)
}

/**
 * Keeps the cached battle score live, and calls `onUpdate` once for every
 * new change (for effects). Stale and duplicate updates are dropped by
 * `version`.
 */
export function useBattleStream(onUpdate?: (update: BattleUpdate) => void) {
  const client = useQueryClient()
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  useEffect(() => {
    queryClient = client
    // Tracked separately from the cache: an admin's own mutation may update
    // the cache before its broadcast arrives, and should still get effects.
    let lastSeen =
      client.getQueryData<BattleState>(battleQuery.queryKey)?.version ?? 0
    const handler: Handler = (update) => {
      if (update.version <= lastSeen) return
      lastSeen = update.version
      onUpdateRef.current?.(update)
    }
    handlers.add(handler)
    start()
    return () => {
      handlers.delete(handler)
    }
  }, [client])
}

/** False while the live connection has been down for a few seconds. */
export function useBattleOnline() {
  return useSyncExternalStore(
    (listener) => {
      statusListeners.add(listener)
      return () => statusListeners.delete(listener)
    },
    () => online,
    () => true
  )
}
