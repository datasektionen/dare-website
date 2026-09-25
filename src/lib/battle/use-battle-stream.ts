import { type QueryClient, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
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
 */

const LOCK = "dare-battle-stream"
const CHANNEL = "dare-battle"

type Handler = (update: BattleUpdate) => void

const handlers = new Set<Handler>()
let started = false

function deliver(update: BattleUpdate) {
  for (const handler of handlers) handler(update)
}

function openSource(onOpen: () => void) {
  const source = new EventSource("/api/battle/events")
  source.onopen = onOpen
  return source
}

/** Starts listening once per tab. Never stopped: it's cheap when idle. */
function start(onReconnect: () => void) {
  if (started) return
  started = true

  const channel =
    "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL) : null
  if (channel) channel.onmessage = (e) => deliver(e.data)

  const lead = () => {
    const source = openSource(onReconnect)
    source.onmessage = (e) => {
      const update: BattleUpdate = JSON.parse(e.data)
      deliver(update)
      channel?.postMessage(update)
    }
    return source
  }

  if (!navigator.locks || !channel) {
    lead()
    return
  }
  // Waits until no other tab holds the lock, then holds it until this tab
  // closes.
  navigator.locks.request(LOCK, () => {
    lead()
    return new Promise<never>(() => {})
  })
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
  const queryClient = useQueryClient()
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  useEffect(() => {
    // Tracked separately from the cache: an admin's own mutation may update
    // the cache before its broadcast arrives, and should still get effects.
    let lastSeen =
      queryClient.getQueryData<BattleState>(battleQuery.queryKey)?.version ?? 0
    const handler: Handler = (update) => {
      if (typeof update?.version !== "number" || update.version <= lastSeen)
        return
      lastSeen = update.version
      applyUpdate(queryClient, update)
      onUpdateRef.current?.(update)
    }
    handlers.add(handler)
    // On every (re)connect, catch up on anything missed while offline.
    start(() =>
      queryClient.invalidateQueries({ queryKey: battleQuery.queryKey })
    )
    return () => {
      handlers.delete(handler)
    }
  }, [queryClient])
}
