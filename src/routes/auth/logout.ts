import { createFileRoute } from "@tanstack/react-router"
import { getAppSession } from "@/lib/auth/session.server"

export const Route = createFileRoute("/auth/logout")({
  server: {
    handlers: {
      POST: async () => {
        const session = await getAppSession()
        await session.clear()
        return new Response(null, { status: 303, headers: { Location: "/" } })
      },
    },
  },
})
