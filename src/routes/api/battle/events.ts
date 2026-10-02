import { createFileRoute } from "@tanstack/react-router"
import { subscribe } from "@/lib/battle/bus.server"
import { readBattle } from "@/lib/battle/state.server"
import type { BattleUpdate } from "@/lib/battle/types"

/**
 * Server-sent events: the current score, then every battle update as it
 * happens, and a `ping` event every 15 s so clients can tell a dead
 * connection from a quiet one (see `use-battle-stream.ts`).
 */
export const Route = createFileRoute("/api/battle/events")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const encoder = new TextEncoder()
        let cleanup = () => {}
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const send = (chunk: string) => {
              try {
                controller.enqueue(encoder.encode(chunk))
              } catch {
                cleanup()
              }
            }
            const sendUpdate = (update: BattleUpdate) =>
              send(`data: ${JSON.stringify(update)}\n\n`)
            send("retry: 2000\n\n")
            // Subscribed first, so nothing falls between the two. Clients
            // drop whichever arrives out of order by `version`.
            const unsubscribe = subscribe(sendUpdate)
            // Catches up a client that was offline. If the database is down,
            // updates still flow and the client's polling fills in later.
            readBattle().then(
              (state) => sendUpdate({ ...state, event: null }),
              (error) => console.error("Reading the battle failed", error)
            )
            // Also keeps proxies from closing an idle connection.
            const heartbeat = setInterval(
              () => send("event: ping\ndata: {}\n\n"),
              15_000
            )
            cleanup = () => {
              clearInterval(heartbeat)
              unsubscribe()
            }
            request.signal.addEventListener("abort", () => {
              cleanup()
              try {
                controller.close()
              } catch {}
            })
          },
          cancel() {
            cleanup()
          },
        })
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        })
      },
    },
  },
})
