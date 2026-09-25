import { createFileRoute } from "@tanstack/react-router"
import { subscribe } from "@/lib/battle/bus.server"
import type { BattleUpdate } from "@/lib/battle/types"

/** Server-sent events: every battle update, as it happens. */
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
            send("retry: 2000\n\n")
            const unsubscribe = subscribe((update: BattleUpdate) =>
              send(`data: ${JSON.stringify(update)}\n\n`)
            )
            // Keeps proxies from closing an idle connection.
            const heartbeat = setInterval(() => send(": ping\n\n"), 20_000)
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
